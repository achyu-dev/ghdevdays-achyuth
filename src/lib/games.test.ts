import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDatabase } from '../../db/test-helpers';
import { categories, publishers, games } from '../../db/schema';
import type { Database } from './db';
import {
    getAllGames,
    getAllGameIds,
    getGameById,
} from './games';

async function seedGames(db: Database, count: number): Promise<void> {
    const [category] = await db
        .insert(categories)
        .values({ name: 'Strategy', description: 'cat' })
        .returning({ id: categories.id });
    const [publisher] = await db
        .insert(publishers)
        .values({ name: 'Pub One', description: 'pub' })
        .returning({ id: publishers.id });

    // Insert titles in reverse-alphabetical order to prove ordering is applied.
    for (let i = count; i >= 1; i--) {
        await db.insert(games).values({
            title: `Game ${String(i).padStart(2, '0')}`,
            description: `Description ${i}`,
            starRating: 4.2,
            categoryId: category.id,
            publisherId: publisher.id,
        });
    }
}

describe('games data-access helpers', () => {
    let db: Database;

    beforeEach(async () => {
        db = await createTestDatabase();
    });

    it('returns all games ordered by title', async () => {
        await seedGames(db, 3);
        const all = await getAllGames(db);
        expect(all.map((g) => g.title)).toEqual(['Game 01', 'Game 02', 'Game 03']);
        expect(all[0].category).toEqual({ id: expect.any(Number), name: 'Strategy' });
        expect(all[0].publisher).toEqual({ id: expect.any(Number), name: 'Pub One' });
    });

    it('filters games by category', async () => {
        const [strategy] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'cat' })
            .returning({ id: categories.id });
        const [party] = await db
            .insert(categories)
            .values({ name: 'Party', description: 'cat' })
            .returning({ id: categories.id });
        const [publisher] = await db
            .insert(publishers)
            .values({ name: 'Pub One', description: 'pub' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha', description: 'a', starRating: 4.1, categoryId: strategy.id, publisherId: publisher.id },
            { title: 'Beta', description: 'b', starRating: 4.1, categoryId: party.id, publisherId: publisher.id },
        ]);

        const filtered = await getAllGames(db, { categoryIds: [strategy.id] });

        expect(filtered.map((game) => game.title)).toEqual(['Alpha']);
    });

    it('filters games by publisher and combines filters', async () => {
        const [category] = await db
            .insert(categories)
            .values({ name: 'Strategy', description: 'cat' })
            .returning({ id: categories.id });
        const [alphaPublisher] = await db
            .insert(publishers)
            .values({ name: 'Alpha Pub', description: 'pub' })
            .returning({ id: publishers.id });
        const [betaPublisher] = await db
            .insert(publishers)
            .values({ name: 'Beta Pub', description: 'pub' })
            .returning({ id: publishers.id });

        await db.insert(games).values([
            { title: 'Alpha', description: 'a', starRating: 4.1, categoryId: category.id, publisherId: alphaPublisher.id },
            { title: 'Beta', description: 'b', starRating: 4.1, categoryId: category.id, publisherId: betaPublisher.id },
        ]);

        const filtered = await getAllGames(db, { categoryIds: [category.id], publisherId: betaPublisher.id });

        expect(filtered.map((game) => game.title)).toEqual(['Beta']);
    });

    it('returns all game ids ordered by title', async () => {
        await seedGames(db, 3);
        const ids = await getAllGameIds(db);
        const all = await getAllGames(db);
        expect(ids).toEqual(all.map((g) => g.id));
    });

    it('fetches a single game by id', async () => {
        await seedGames(db, 2);
        const ids = await getAllGameIds(db);
        const game = await getGameById(db, ids[0]);
        expect(game?.title).toBe('Game 01');
    });

    it('returns null for a non-existent game', async () => {
        await seedGames(db, 2);
        expect(await getGameById(db, 99999)).toBeNull();
    });
});
