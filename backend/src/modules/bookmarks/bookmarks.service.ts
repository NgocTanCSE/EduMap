import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Bookmark } from './entities/bookmark.entity';
import { CreateBookmarkDto } from './dto/bookmark.dto';
const logger = new Logger('BookmarksService');
const TITLE_JOINS: Record<string, {
    table: string;
    label: string;
}> = {
    poi: { table: 'map_points', label: 'name' },
    job: { table: 'jobs', label: 'title' },
    event: { table: 'events', label: 'title' },
    opportunity: { table: 'opportunities', label: 'title' },
    internships: { table: 'internships', label: 'title' },
    scholarships: { table: 'scholarships', label: 'title' },
    marketplace_product: { table: 'products', label: 'name' },
    marketplace_service: { table: 'business_services', label: 'name' },
    shared_item: { table: 'shared_items', label: 'name' },
    library_item: { table: 'learning_materials', label: 'title' },
    hackathon: { table: 'hackathons', label: 'title' },
};
@Injectable()
export class BookmarksService {
    constructor(
    @InjectRepository(Bookmark)
    private readonly bookmarkRepo: Repository<Bookmark>, private readonly dataSource: DataSource) { }
    async listBookmarks(userId: string, targetType?: string): Promise<Bookmark[]> {
        const where: Record<string, any> = { userId };
        if (targetType)
            where.targetType = targetType;
        return this.bookmarkRepo.find({ where, order: { createdAt: 'DESC' } });
    }
    async listBookmarksDetailed(userId: string, targetType?: string): Promise<Array<{
        target_type: string;
        target_id: string;
        title: string | null;
        created_at: Date;
    }>> {
        const bookmarks = await this.listBookmarks(userId, targetType);
        const byType = new Map<string, Bookmark[]>();
        for (const b of bookmarks) {
            const arr = byType.get(b.targetType) || [];
            arr.push(b);
            byType.set(b.targetType, arr);
        }
        const titles = new Map<string, Map<string, string>>();
        for (const [type, items] of byType) {
            const tj = TITLE_JOINS[type];
            if (!tj)
                continue;
            const ids = items.map((b) => b.targetId);
            const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
            try {
                const rows = await this.dataSource.query(`SELECT CAST(id AS TEXT) AS id, "${tj.label}" AS title FROM ${tj.table} WHERE CAST(id AS TEXT) IN (${placeholders})`, ids);
                const m = new Map<string, string>();
                for (const r of rows as Array<{
                    id: string;
                    title: string;
                }>)
                    m.set(r.id, r.title);
                titles.set(type, m);
            }
            catch (e) {
                logger.warn(`Bookmark title lookup failed for type=${type} (table=${tj.table}): ${(e as Error).message}`);
                titles.set(type, new Map());
            }
        }
        return bookmarks.map((b) => ({
            target_type: b.targetType,
            target_id: b.targetId,
            title: titles.get(b.targetType)?.get(b.targetId) ?? null,
            created_at: b.createdAt,
        }));
    }
    async toggleBookmark(userId: string, dto: CreateBookmarkDto): Promise<boolean> {
        const existing = await this.bookmarkRepo.findOne({
            where: {
                userId,
                targetType: dto.target_type,
                targetId: dto.target_id,
            },
        });
        if (existing) {
            await this.bookmarkRepo.remove(existing);
            return false;
        }
        await this.bookmarkRepo.insert({
            userId,
            targetType: dto.target_type,
            targetId: dto.target_id,
        });
        return true;
    }
}
