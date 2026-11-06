import { Controller, Get, Post, Query, Body, Logger } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { GeoVisionService } from './geo-vision.service';
import { SatelliteTilesQueryDto, VisionDetectBodyDto, VisionDetectResult } from './dto/vision-detect.dto';
@Controller('geo')
export class GeoVisionController {
    private readonly logger = new Logger(GeoVisionController.name);
    constructor(private readonly geoVisionService: GeoVisionService) { }
    @Get('satellite-tiles')
    @SkipThrottle()
    async getSatelliteTiles(
    @Query('bbox')
    bbox: string, 
    @Query('zoom')
    zoom?: string, 
    @Query('source')
    source?: string) {
        if (!bbox) {
            return { success: false, error: 'bbox query parameter is required. Format: minLat,maxLat,minLng,maxLng' };
        }
        try {
            const z = zoom ? parseInt(zoom, 10) : 18;
            const src = source || 'osm';
            const result = await this.geoVisionService.fetchAndStitchTiles(bbox, z, src);
            return {
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
            };
        }
        catch (e: any) {
            this.logger.error(`satellite-tiles failed: ${e.message}`);
            return { success: false, error: e.message };
        }
    }
    @Post('vision-detect')
    @SkipThrottle()
    async visionDetect(
    @Body()
    body: VisionDetectBodyDto) {
        if (!body.bbox) {
            return { success: false, error: 'bbox is required. Format: "minLat,maxLat,minLng,maxLng"' };
        }
        try {
            const result: VisionDetectResult = await this.geoVisionService.runVisionDetect(body);
            return {
                success: true,
                data: result,
                timestamp: new Date().toISOString(),
            };
        }
        catch (e: any) {
            this.logger.error(`vision-detect failed: ${e.message}`);
            return {
                success: true,
                data: {
                    detections: [],
                    known: [],
                    new: [],
                    bbox: body.bbox,
                    zoom: body.zoom || 18,
                    stitched_metadata: { width: 0, height: 0, tile_count: 0, tile_coords: [], source: body.source || 'osm' },
                    degraded: true,
                    error: e.message,
                },
                timestamp: new Date().toISOString(),
            };
        }
    }
}
