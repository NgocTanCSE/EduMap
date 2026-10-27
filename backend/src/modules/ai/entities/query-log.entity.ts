/**
 * query_logs — anonymized analytics for Idea #17 (AI Question Gap Report).
 *
 * Privacy rules:
 *   • ``userId`` is NEVER stored in plain text. The backend hashes it with
 *     SHA-256 before this entity is persisted (see AIService._logQuery).
 *   • The table column is ``user_id_hash`` so the raw identifier cannot be
 *     reconstructed from the database.
 *   • A 30-day TTL sweep runs in sqlite-bootstrap.ts on every boot.
 *
 * The ai-service reads this table read-only (via ``_query_sqlite``) to
 * cluster anonymized queries and identify knowledge gaps.
 */
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('query_logs')
@Index(['userIdHash', 'createdAt'])
@Index(['retrievalStatus'])
export class QueryLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** SHA-256 hex digest of the real user_id — never the raw value. */
  @Column({ name: 'user_id_hash', nullable: true })
  userIdHash: string;

  @Column({ name: 'query_text', type: 'text' })
  queryText: string;

  @Column({ name: 'retrieved_doc_count', type: 'integer', default: 0 })
  retrievedDocCount: number;

  /** 'success' | 'partial' | 'failed' */
  @Column({ name: 'retrieval_status', length: 20, nullable: true })
  retrievalStatus: string;

  @Column({ name: 'response_text', type: 'text', nullable: true })
  responseText: string;

  /** 0.0 – 1.0 heuristic quality score. Lower = likely a gap. */
  @Column({ name: 'response_quality', type: 'real', nullable: true })
  responseQuality: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
