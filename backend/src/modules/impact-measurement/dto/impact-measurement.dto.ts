import { IsEnum, IsIn, IsInt, IsISO8601, IsLatitude, IsLongitude, IsNumber, IsNumberString, IsOptional, IsString, Max, Min } from 'class-validator';
export const FACILITY_TYPE_VALUES = ['wifi', 'library', 'school', 'university', 'lab', 'green', 'cafe'] as const;
export type FacilityType = (typeof FACILITY_TYPE_VALUES)[number];
export class ImpactMetricsQueryDto {
    @IsOptional()
    @IsNumberString()
    minLat?: string;
    @IsOptional()
    @IsNumberString()
    maxLat?: string;
    @IsOptional()
    @IsNumberString()
    minLng?: string;
    @IsOptional()
    @IsNumberString()
    maxLng?: string;
    @IsOptional()
    @IsLatitude()
    lat?: number;
    @IsOptional()
    @IsLongitude()
    lng?: number;
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    radiusKm?: number;
    @IsOptional()
    @IsString()
    deploymentDate?: string;
    @IsOptional()
    @IsString()
    region?: string;
}
export class MeasureImpactDto {
    @IsOptional()
    @IsNumber()
    minLat?: number;
    @IsOptional()
    @IsNumber()
    maxLat?: number;
    @IsOptional()
    @IsNumber()
    minLng?: number;
    @IsOptional()
    @IsNumber()
    maxLng?: number;
    @IsOptional()
    @IsLatitude()
    lat?: number;
    @IsOptional()
    @IsLongitude()
    lng?: number;
    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
    radiusKm?: number;
    @IsOptional()
    @IsString()
    deploymentDate?: string;
    @IsOptional()
    @IsString()
    region?: string;
    @IsOptional()
    facilityTypes?: FacilityType[];
}
export class MeasureImpactQueryDto {
    @IsOptional()
    @IsNumberString()
    minLat?: string;
    @IsOptional()
    @IsNumberString()
    maxLat?: string;
    @IsOptional()
    @IsNumberString()
    minLng?: string;
    @IsOptional()
    @IsNumberString()
    maxLng?: string;
    @IsOptional()
    @IsNumberString()
    lat?: string;
    @IsOptional()
    @IsNumberString()
    lng?: string;
    @IsOptional()
    @IsNumberString()
    radiusKm?: string;
    @IsOptional()
    @IsString()
    deploymentDate?: string;
    @IsOptional()
    @IsString()
    region?: string;
    @IsOptional()
    facilityTypes?: string | string[];
}
