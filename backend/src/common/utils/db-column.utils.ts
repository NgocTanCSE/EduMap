export function geoPointColumn(): Record<string, unknown> {
    return { type: 'geography', spatialFeatureType: 'Point', srid: 4326 };
}

type GeoFeature = 'Point' | 'Polygon' | 'LineString' | 'Geometry';

export function geoColumn(featureType: GeoFeature = 'Point'): Record<string, unknown> {
    return { type: 'geography', spatialFeatureType: featureType, srid: 4326 };
}

export function jsonColumn(nullable = false): Record<string, unknown> {
    return { type: 'jsonb', nullable };
}

export function datetimeColumn(nullable = false, withTimezone = false): Record<string, unknown> {
    return {
        type: withTimezone ? 'timestamp with time zone' : 'timestamp',
        nullable,
    };
}

export function enumColumn(): Record<string, unknown> {
    return { type: 'enum' };
}

export function textArrayColumn(): Record<string, unknown> {
    return { type: 'text', array: true, default: '{}' };
}