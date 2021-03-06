/**
 * Copyright (c) Codice Foundation
 *
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 *
 **/
/*global define*/
/*jshint -W024*/
/** Main view page for add. */
define([
    'icanhaz',
    'marionette',
    'backbone',
    'js/model/Accordion.collection.js',
    'js/model/Organization.js',
    'js/view/AccordionCollectionView.js',
    'js/view/ConfigurationEdit.view.js',
    'js/view/Organization.view.js',
    'js/model/Service.js',
    'js/view/Utils.js',
    'wreqr',
    'underscore',
    'jquery',
    'text!templates/sourceModal.handlebars',
    'text!templates/optionListType.handlebars',
    'text!templates/textType.handlebars',
    'text!templates/sourceOrganization.hbs',
    'text!templates/optionLabelType.hbs'

], function (ich, Marionette, Backbone, AccordionCollection, Organization, AccordionCollectionView, ConfigurationEdit, OrganizationView, Service, Utils, wreqr, _, $, sourceModal, optionListType, textType, sourceOrganization, optionLabelType) {

    if (!ich.sourceOrganization) {
        ich.addTemplate('sourceOrganization', sourceOrganization);
    }
    if (!ich.sourceModal) {
        ich.addTemplate('sourceModal', sourceModal);
    }
    if (!ich.optionListType) {
        ich.addTemplate('optionListType', optionListType);
    }
    if (!ich.textType) {
        ich.addTemplate('textType', textType);
    }
    if (!ich.optionLabelType) {
        ich.addTemplate('optionLabelType', optionLabelType);
    }

    var ModalSource = {};

    ModalSource.View = Marionette.Layout.extend({
        template: 'sourceModal',
        className: 'modal',
        events: {
            "change .activeBindingSelect": "handleTypeChange",
            "click .submit-button": "submitData",
            "click .cancel-button": "cancel",
            "change .sourceName": "sourceNameChanged"
        },
        regions: {
            organizationInfo: '.modal-organization',
            details: '.modal-details',
            accordions: '.modal-accordions',
            buttons: '.source-buttons'
        },
        serializeData: function () {
            var data = {};

            if (this.model) {
                data = this.model.toJSON();
            }
            data.mode = this.mode;
            //Mark this data as a registry by populating isRegistry with its registry uuid
            data.isRegistry = this.model.get('registryId');
            if (data.isRegistry) {
                //Gather registry information about the available registries
                data.availableRegistries = this.getAvailableRegistries(this.source.get('model').registryService);
                //availableRegistries contains all known registry services
                var listAlreadyPublishedTo = this.getAlreadyPublished(this.source.get('model').registryMetacards.get('value'), data.isRegistry);
                //listAlreadyPublishedTo contains names of registries we have already published to
                data.availableRegistries.forEach(function (regObj) {
                    listAlreadyPublishedTo.forEach(function (pubTo) {
                        if (regObj.name === pubTo) {
                            regObj.alreadyPublishedTo = true;
                        }

                    });
                });
            }
            return data;
        },
        /**
         * Returns information about which registries are available to this model (note: alreadyPublishedTo field added to track
         * if a source has been previously published to. This field is for next iteration and is not in a useable state)
         *
         */
        getAlreadyPublished: function (registryMetacards, registryId) {
            var alreadyPublishedTo = [];
            registryMetacards.forEach(function (reg) {
                if (reg.id === registryId && reg.TransientValues && reg.TransientValues["published-locations"] && !_.isEmpty(reg.TransientValues["published-locations"])) {
                    reg.TransientValues["published-locations"].forEach(function (pubLoc) {
                        alreadyPublishedTo.push(pubLoc);
                    });
                }
            });
            return alreadyPublishedTo;
        },


        getAvailableRegistries: function (registryServices) {
            var availableRegistries = [];
            registryServices.get("value").forEach(function (service) {
                var regToAdd = {};
                if (service.configurations.length !== 0) {
                    regToAdd.name = service.configurations[0].properties.id;
                    regToAdd.alreadyPublishedTo = false;
                    availableRegistries.push(regToAdd);
                }
            });
            return availableRegistries;
        },
        /**
         * Initialize  the binder with the ManagedServiceFactory model.
         * @param options
         */
        initialize: function (options) {
            _.bindAll(this);
            this.source = options.source;
            this.modelBinder = new Backbone.ModelBinder();
            this.mode = options.mode;
        },
        onRender: function () {
            var config = this.model.get('currentConfiguration') || this.model.get('disabledConfigurations').at(0);
            var properties = config.get('properties');

            this.$el.attr('role', "dialog");
            this.$el.attr('aria-hidden', "true");
            this.renderNameField();
            this.renderTypeDropdown();
            this.initRadioButtonUI(properties);
            if (!_.isNull(this.model)) {
                this.rebind(properties);
            }
        },
        initRadioButtonUI: function (boundModel) {
            var $radios = this.$el.find('input[type=radio]');
            var view = this;

            _.each($radios, function (radio) {
                var $radio = view.$(radio);
                var $label = $radio.closest('label.btn');
                if (boundModel.get($radio.attr('name')) === $radio.attr('value')) {
                    $label.addClass('active');
                } else {
                    $label.removeClass('active');
                }
            });
        },
        /**
         * Renders editable name field.
         */
        renderNameField: function () {
            var model = this.model;
            var $sourceName = this.$(".sourceName");
            var initialName = model.get('name');
            var data = {
                id: model.id,
                name: 'Source Name',
                defaultValue: [initialName],
                description: 'Unique identifier for all source configurations of this type.'
            };
            $sourceName.append(ich.textType(data));
            $sourceName.val(data.defaultValue);
            Utils.setupPopOvers($sourceName, data.id, data.name, data.description);
        },
        /**
         * Renders the type dropdown box
         */
        renderTypeDropdown: function () {
            var $sourceTypeSelect = this.$(".activeBindingSelect");
            var configs = this.getAllConfigServices();
            $sourceTypeSelect.append(ich.optionListType({
                "list": configs.toJSON()
            }));
            $sourceTypeSelect.val(configs.at(0).get('id')).change();
        },
        /**
         * Uses the current context's model to return a Backbone collection of all configurations service's
         */
        getAllConfigServices: function () {
            var configs = new Backbone.Collection();
            var disabledConfigs = this.model.get('disabledConfigurations');
            var currentConfig = this.model.get('currentConfiguration');
            if (!_.isUndefined(currentConfig)) {
                var currentService = currentConfig.get('service');
                configs.add(currentService);
            }
            if (!_.isUndefined(disabledConfigs)) {
                disabledConfigs.each(function (config) {
                    configs.add(config.get('service'));
                });
            }
            return configs;
        },
        /**
         * Submit to the backend. This is called when 'Add' or 'Save' are clicked in the Modal.
         * If the service.save call is successful and the current node is a registry, a backend call
         * to publish to the selected registries is made
         */
        submitData: function () {
            wreqr.vent.trigger('beforesave');
            var view = this;
            var configs = this.getAllConfigsWithServices();
            configs.forEach(function (config) {
                var service = config;
                if (service) {
                    if (_.isUndefined(service.get('properties').id)) {
                        var name = view.$(".sourceName").find('input').val().trim();
                        view.setConfigName(service, name);
                    }

                    service.save().then(function () {
                            // Since saving was successful, make publish call
                            // This avoids publishing if any error occurs in service.save()

                            wreqr.vent.trigger('refreshSources');
                            view.closeAndUnbind();
                        },

                        function () {
                            wreqr.vent.trigger('refreshSources');
                        }).always(function () {
                        view.closeAndUnbind();
                    });
                }
            });
            // If view.model represents a registry, gather the registries to publishTo
            // based on the checked checkboxes and call metacard model's publishTo()
            if (view.model.get('registryId')) {
                var idToPublishFrom = "";
                var idsToPublishTo = [];
                var $checkboxArray = $(':checkbox:checked');
                _.each($checkboxArray, function (checkbox) {
                    idsToPublishTo.push(checkbox.value);
                });
                idToPublishFrom = view.model.get('registryId');
                view.source.model.registryMetacards.publishTo(idToPublishFrom, idsToPublishTo);
            }
        },
        sourceNameChanged: function (evt) {
            var newName = this.$(evt.currentTarget).find('input').val().trim();
            this.checkName(newName);
        },
        checkName: function (newName) {
            var view = this;
            var model = view.model;
            var config = model.get('currentConfiguration');
            var disConfigs = model.get('disabledConfigurations');

            if (newName === '') {
                view.showError('A source must have a name.');
            } else if (newName !== model.get('name')) {
                if (view.nameIsValid(newName, model.get('editConfig').get('fpid'))) {
                    this.setConfigName(config, newName);
                    if (!_.isUndefined(disConfigs)) {
                        disConfigs.each(function (cfg) {
                            view.setConfigName(cfg, newName);
                        });
                    }
                    view.clearError();
                } else {
                    view.showError('A configuration with the name "' + newName + '" already exists. Please choose another name.');
                }
            } else {
                // model name was reverted back to original value
                view.clearError();
            }
        },
        showError: function (msg) {
            var view = this;
            var $group = view.$el.find('.sourceName>.control-group');

            $group.find('.error-text').text(msg).show();
            view.$el.find('.submit-button').attr('disabled', 'disabled');
            $group.addClass('has-error');
        },
        clearError: function () {
            var view = this;
            var $group = view.$el.find('.sourceName>.control-group');
            var $error = $group.find('.error-text');

            view.$el.find('.submit-button').removeAttr('disabled');
            $group.removeClass('has-error');
            $error.hide();
        },
        setConfigName: function (config, name) {
            if (!_.isUndefined(config)) {
                var properties = config.get('properties');
                properties.set({
                    'shortname': name,
                    'id': name
                });

            }
        },
        /**
         * Returns true if any of the existing source configurations have a name matching the name parameter and false otherwise.
         */
        nameExists: function (name) {
            var configs = this.parentModel.get('collection');
            var match = configs.find(function (sourceConfig) {
                return sourceConfig.get('name') === name;
            });
            return !_.isUndefined(match);
        },
        nameIsValid: function (name, fpid) {
            var valid = false;
            var configs = this.source.get('collection');
            var match = configs.find(function (sourceConfig) {
                return sourceConfig.get('name') === name;
            });
            if (_.isUndefined(match)) {
                valid = true;
            } else {
                valid = !this.fpidExists(match, fpid);
            }
            return valid;
        },
        fpidExists: function (model, fpid) {
            var modelConfig = model.get('currentConfiguration');
            var disabledConfigs = model.get('disabledConfigurations');
            var matchFound = false;

            if (!_.isUndefined(modelConfig) && (modelConfig.get('fpid') === fpid || modelConfig.get('fpid') + "_disabled" === fpid)) {
                matchFound = true;
            } else if (!_.isUndefined(disabledConfigs)) {
                matchFound = !_.isUndefined(disabledConfigs.find(function (modelDisableConfig) {
                    // check the ID property to ensure that the config we're checking exists server side
                    // otherwise assume it's a template/placeholder for filling in the default modal form data
                    if (_.isUndefined(modelDisableConfig.id)) {
                        return false;
                    } else {
                        return (modelDisableConfig.get('fpid') === fpid || modelDisableConfig.get('fpid') + "_disabled" === fpid);
                    }
                }));
            }
            return matchFound;
        },
        // should be able to remove this method when the 'shortname' is removed from existing source metatypes
        getId: function (config) {
            var properties = config.get('properties');
            return properties.get('shortname') || properties.get('id');
        },
        closeAndUnbind: function () {
            this.modelBinder.unbind();
            this.$el.modal("hide");
        },
        /**
         * Unbind the model and dom during close.
         */
        onClose: function () {
            this.modelBinder.unbind();
        },
        cancel: function () {
            this.closeAndUnbind();
        },
        /**
         *  Called when the activebinding dropdown is changed and also when the source
         *  modal is first created.
         */
        handleTypeChange: function (evt) {
            var view = this;
            var $select = this.$(evt.currentTarget);
            if ($select.hasClass('activeBindingSelect')) {
                this.modelBinder.unbind();
                var config = view.findConfigFromId($select.val());
                view.model.set('editConfig', config);

                var properties = config.get('properties');
                view.checkName(view.$('.sourceName').find('input').val().trim());
                view.renderDetails(config);
                view.initRadioButtonUI(properties);
                view.rebind(properties);
            }
            view.$el.trigger('shown.bs.modal');
        },
        rebind: function (properties) {
            var $boundData = this.$el.find('.bound-controls');
            var bindings = Backbone.ModelBinder.createDefaultBindings($boundData, 'name');
            //this is done so that model binder wont watch these values. We need to handle this ourselves.
            delete bindings.value;
            this.modelBinder.bind(properties, $boundData, bindings);
        },
        /**
         *  Retrieve a configuration with its service by its string id.
         */
        findConfigFromId: function (id) {
            var model = this.model;
            var currentConfig = model.get('currentConfiguration');
            var disabledConfigs = model.get('disabledConfigurations');
            var config;
            if (!_.isUndefined(currentConfig) && currentConfig.get('fpid') === id) {
                config = currentConfig;
            } else {
                if (!_.isUndefined(disabledConfigs)) {
                    config = disabledConfigs.find(function (item) {
                        var service = item.get('service');
                        if (!_.isUndefined(service) && !_.isNull(service)) {
                            return service.get('id') === id;
                        }
                        return false;
                    });
                }
            }

            return config;
        },
        /**
         *  Method to get a list of all configs, each with its corresponding service and properties
         */
        getAllConfigsWithServices: function () {
            var theConfigs = this.getAllConfigServices();
            var listOfConfigStrings = [];
            theConfigs.models.forEach(function (con) {
                listOfConfigStrings.push(con.id);
            }.bind(this));
            var configsWithServices = [];
            listOfConfigStrings.forEach(function (conString) {
                configsWithServices.push(this.findConfigFromId(conString));
            }.bind(this));
            return configsWithServices;
        },
        /**
         *  Helper method for getOrganizationalModel
         */
        getOrgProperty: function (orgObj, valueToFind, valueIfNotFound) {
            if (orgObj[valueToFind]) {
                return orgObj[valueToFind];
            } else if (valueIfNotFound) {
                return valueIfNotFound;
            } else {
                return "N/A";
            }
        },
        /**
         * Given a registry metacard with organizational information, collects the organizational infomation
         * and returns a model representing it.
         */
        getOrganizationModel: function (registryMetacard) {
            var orgInfo = {};
            if (registryMetacard.RegistryObjectList.Organization) {
                if (registryMetacard.RegistryObjectList.Organization[0]) {
                    if (registryMetacard.RegistryObjectList.Organization[0].Address) {
                        var address = registryMetacard.RegistryObjectList.Organization[0].Address[0];
                        orgInfo.address = this.getOrgModelHelper(address, "city", "") + " ";
                        orgInfo.address += this.getOrgModelHelper(address, "stateOrProvince", "") + " ";
                        orgInfo.address += this.getOrgModelHelper(address, "country", "") + " ";
                        orgInfo.address += this.getOrgModelHelper(address, "postalCode", "");
                    }
                    if (registryMetacard.RegistryObjectList.Organization[0].Name) {
                        orgInfo.name = this.getOrgModelHelper(registryMetacard.RegistryObjectList.Organization[0], "Name", "");
                    }
                    if (registryMetacard.RegistryObjectList.Organization[0].TelephoneNumber) {
                        var phoneNumber = registryMetacard.RegistryObjectList.Organization[0].TelephoneNumber[0];
                        orgInfo.phoneNumber = this.getOrgModelHelper(phoneNumber, "countryCode", "?") + "-";
                        orgInfo.phoneNumber += this.getOrgModelHelper(phoneNumber, "areaCode", "???") + "-";
                        orgInfo.phoneNumber += this.getOrgModelHelper(phoneNumber, "number", "???????");
                        if (phoneNumber.extension) {
                            orgInfo.phoneNumber += " ext. ";
                            orgInfo.phoneNumber += this.getOrgModelHelper(phoneNumber, "extension", "???????");
                        }
                        orgInfo.phoneNumber += " (" + this.getOrgModelHelper(phoneNumber, "phoneType", "Contact") + ")";
                    }
                    var emailAddress = registryMetacard.RegistryObjectList.Organization[0].EmailAddress;
                    if (emailAddress) {
                        orgInfo.emailAddress = this.getOrgModelHelper(registryMetacard.RegistryObjectList.Organization[0].EmailAddress[0], "address", "N/A");
                        orgInfo.emailAddress += " (" + this.getOrgModelHelper(registryMetacard.RegistryObjectList.Organization[0].EmailAddress[0], "type", "Contact") + ")";
                    }
                }
            }
            return new Organization(orgInfo);
        },
        renderDetails: function (configuration) {
            var service = configuration.get('service');
            if (!_.isUndefined(service)) {
                // If this source being edited is a registry
                if (this.model.get('editConfig').get('properties').get('registry-id')) {
                    // Since this is a registry, if edit mode, populate the organizational info
                    if (this.mode === 'edit') {
                        var orgModel = new Organization();
                        // find the metacard that corresponds to the current model and extract it's organizational info (if it has any)
                        this.source.get('model').registryMetacards.get('value').forEach(function (regObj) {
                            if (this.model.get('registryId') === regObj.id || this.model.get('editConfig').get('properties').get('registry-id') === regObj.id) {
                                orgModel = this.getOrganizationModel(regObj);
                            }
                        }.bind(this));
                        var orgViewInstance = new OrganizationView({
                            model: orgModel
                        });
                        this.organizationInfo.show(orgViewInstance);
                    }
                }
                // Make an accordionCollection to hold the accordions. Uses AccordionView as it's itemView
                var accordionCollection = new AccordionCollection();
                var configsWithServices = this.getAllConfigsWithServices();
                // For each configuration, make an accordion consisting of a ConfigurationEdit.ConfigurationCollection that
                // is populated with ConfigurationEdit.ConfigurationItem's
                configsWithServices.forEach(function (curConfig) {
                    var accordionFieldsToDisplay;
                    // Use the curConfig's service to gather all fields to display in the accordion
                    var curConfigService = curConfig.get('service');
                    if (!_.isUndefined(curConfigService)) {
                        accordionFieldsToDisplay = curConfigService.get('metatype').filter(function (mt) {
                            return !_.contains(['shortname', 'id'], mt.get('id'));
                        });
                    }

                    var collectionToDisplay = new Service.MetatypeList(accordionFieldsToDisplay);
                    var nameToDisplay = curConfig.get('name');
                    // Check if name is in fpid format and if so, clean up the nameToDisplay
                    if (nameToDisplay.includes('_disabled')) {
                        nameToDisplay = nameToDisplay.substring(0, nameToDisplay.indexOf('_disabled'));
                        nameToDisplay = nameToDisplay.replace(/_/g, ' ');
                    }
                    accordionCollection.add({
                        title: nameToDisplay,
                        contentView: new ConfigurationEdit.ConfigurationCollection({
                            collection: collectionToDisplay,
                            service: curConfigService,
                            configuration: curConfig
                        })
                    });
                }.bind(this));
                // Add the accordions to the accordions region of the modal
                this.accordions.show(new AccordionCollectionView({
                    collection: accordionCollection
                }));
            } else {
                this.$(this.organizationInfo.el).html('');
                this.$(this.details.el).html('');
                this.$(this.buttons.el).html('');
            }
        }
    });
    return ModalSource;
});