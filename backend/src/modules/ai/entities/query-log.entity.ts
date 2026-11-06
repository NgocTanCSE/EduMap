import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';
@Entity('query_logs')
@Index(['userIdHash', 'createdAt'])
@Index(['retrievalStatus'])
export class QueryLog {
    @PrimaryGeneratedColumn('uuid')
    id: string;
    @Column({ name: 'user_id_hash', nullable: true })
    userIdHash: string;
    @Column({ name: 'query_text', type: 'text' })
    queryText: string;
    @Column({ name: 'retrieved_doc_count', type: 'integer', default: 0 })
    retrievedDocCount: number;
    @Column({ name: 'retrieval_status', length: 20, nullable: true })
    retrievalStatus: string;
    @Column({ name: 'response_text', type: 'text', nullable: true })
    responseText: string;
    @Column({ name: 'response_quality', type: 'real', nullable: true })
    responseQuality: number;
    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;
}
