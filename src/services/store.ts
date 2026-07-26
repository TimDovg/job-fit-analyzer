import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";
import type { Source, StoredVacancy } from "../types.js";

export class Store {
  private db: Database.Database;

  constructor() {
    fs.mkdirSync(config.dataDir, { recursive: true });
    this.db = new Database(path.join(config.dataDir, "job-watch.sqlite"));
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      create table if not exists vacancies (
        source text not null,
        url text not null,
        title text,
        company text,
        content_hash text not null,
        discovered_at text not null,
        published_at text,
        analyzed_at text,
        score real,
        analysis_text text,
        primary key (source, url)
      );
    `);
  }

  get(source: Source, url: string): StoredVacancy | undefined {
    return this.db
      .prepare("select source, url, content_hash as contentHash, analyzed_at as analyzedAt, score from vacancies where source = ? and url = ?")
      .get(source, url) as StoredVacancy | undefined;
  }

  upsertDiscovered(input: {
    source: Source;
    url: string;
    title: string;
    company?: string;
    contentHash: string;
    discoveredAt: string;
    publishedAt?: string;
  }): void {
    this.db
      .prepare(`
        insert into vacancies (source, url, title, company, content_hash, discovered_at, published_at)
        values (@source, @url, @title, @company, @contentHash, @discoveredAt, @publishedAt)
        on conflict(source, url) do update set
          title = excluded.title,
          company = excluded.company,
          content_hash = excluded.content_hash,
          published_at = excluded.published_at
      `)
      .run(input);
  }

  markAnalyzed(input: {
    source: Source;
    url: string;
    analyzedAt: string;
    score: number;
    analysisText: string;
  }): void {
    this.db
      .prepare(`
        update vacancies
        set analyzed_at = @analyzedAt,
            score = @score,
            analysis_text = @analysisText
        where source = @source and url = @url
      `)
      .run(input);
  }

  close(): void {
    this.db.close();
  }
}
