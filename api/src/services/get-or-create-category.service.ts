import type { Category } from "@financialtracker/shared";
import { badRequest } from "../errors.js";
import type { CategoryRepository } from "../repositories/postgres/category.repository.js";

export class GetOrCreateCategoryService {
  constructor(private readonly categories: Pick<CategoryRepository, "findByName" | "create">) {}

  /** Case-insensitive: "food" reuses an existing "Food". */
  async execute(userId: number, rawName: string): Promise<Category> {
    const name = rawName.trim();
    if (!name) throw badRequest("Category name is required");
    if (name.length > 50) throw badRequest("Category name must be at most 50 characters");
    return (await this.categories.findByName(userId, name)) ?? this.categories.create(userId, name);
  }
}
