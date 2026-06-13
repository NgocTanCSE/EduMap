import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdditionalTables1790000000000 implements MigrationInterface {
    name = 'AddAdditionalTables1790000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Volunteer Hours
        await queryRunner.query(`CREATE TABLE "volunteer_hours" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "date" date NOT NULL, "hours" integer NOT NULL DEFAULT '0', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_volunteer_hours_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "volunteer_hours" ADD CONSTRAINT "FK_volunteer_hours_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // WiFi Connections
        await queryRunner.query(`CREATE TABLE "wifi_connections" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "wifi_id" uuid NOT NULL, "user_id" uuid NOT NULL, "connected_at" TIMESTAMP NOT NULL DEFAULT now(), "disconnected_at" TIMESTAMP, CONSTRAINT "PK_wifi_connections_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "wifi_connections" ADD CONSTRAINT "FK_wifi_connections_wifi_id" FOREIGN KEY ("wifi_id") REFERENCES "wifi_locations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "wifi_connections" ADD CONSTRAINT "FK_wifi_connections_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Mentor Sessions
        await queryRunner.query(`CREATE TABLE "mentor_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mentor_id" uuid NOT NULL, "student_id" uuid NOT NULL, "slot_start" TIMESTAMP NOT NULL, "slot_end" TIMESTAMP NOT NULL, "status" character varying NOT NULL DEFAULT 'pending', "meeting_url" character varying, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_mentor_sessions_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "mentor_sessions" ADD CONSTRAINT "FK_mentor_sessions_mentor_id" FOREIGN KEY ("mentor_id") REFERENCES "mentors"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mentor_sessions" ADD CONSTRAINT "FK_mentor_sessions_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);

        // Mentor Relationships
        await queryRunner.query(`CREATE TABLE "mentor_relationships" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "mentor_id" uuid NOT NULL, "student_id" uuid NOT NULL, "status" character varying NOT NULL DEFAULT 'active', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_mentor_relationships_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "mentor_relationships" ADD CONSTRAINT "FK_mentor_relationships_mentor_id" FOREIGN KEY ("mentor_id") REFERENCES "mentors"("user_id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "mentor_relationships" ADD CONSTRAINT "FK_mentor_relationships_student_id" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "mentor_relationships"`);
        await queryRunner.query(`DROP TABLE "mentor_sessions"`);
        await queryRunner.query(`DROP TABLE "wifi_connections"`);
        await queryRunner.query(`DROP TABLE "volunteer_hours"`);
    }
}
