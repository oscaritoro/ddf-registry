/**
 * Copyright (c) Codice Foundation
 * <p/>
 * This is free software: you can redistribute it and/or modify it under the terms of the GNU Lesser
 * General Public License as published by the Free Software Foundation, either version 3 of the
 * License, or any later version.
 * <p/>
 * This program is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without
 * even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details. A copy of the GNU Lesser General Public License
 * is distributed along with this program and can be found at
 * <http://www.gnu.org/licenses/lgpl.html>.
 */
package ddf.catalog.cache.impl;

import java.util.Set;

import ddf.catalog.content.data.ContentItem;
import ddf.catalog.data.Metacard;
import ddf.catalog.operation.ResourceRequest;

public class CacheKey {

    private Metacard metacard;

    private ResourceRequest resourceRequest;

    public CacheKey(Metacard metacard, ResourceRequest resourceRequest) {

        if (metacard == null) {
            throw new IllegalArgumentException("Metacard must not be null.");
        }

        if (resourceRequest == null) {
            throw new IllegalArgumentException("ResourceRequest must not be null.");
        }

        this.metacard = metacard;
        this.resourceRequest = resourceRequest;
    }

    /**
     * Key is comprised of the source, the metacard ID, and request properties if properties are
     * found. <br/>
     * Sample: <br/>
     * {@code <sourceId>-<metacardId>[-<RESOURCE_OPTION>]}
     *
     * @return key
     */
    public String generateKey() {

        Set<String> names = resourceRequest.getPropertyNames();

        String properties = "";

        // The OPTION_ARGUMENT, e.g., Photograph, PDF, etc., is the only resource request option 
        // that alters the InputStream to be read for resource retrieval, so only look for that 
        // option when generating the unique cache key.
        for (String propertyName : names) {
            if (ResourceRequest.OPTION_ARGUMENT.equals(propertyName)
                    || ContentItem.QUALIFIER.equals(propertyName)) {
                properties = "_" + propertyName + "-" + resourceRequest.getPropertyValue(
                        propertyName);
                break;
            }
        }

        return metacard.getSourceId() + "-" + metacard.getId() + properties;
    }
}
