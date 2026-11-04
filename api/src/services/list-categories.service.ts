import type { Category } from "@financialtracker/shared";
import type { CategoryRepository } from "../repositories/postgres/category.repository.js";

export class ListCategoriesService {
  constructor(private readonly categories: Pick<CategoryRepository, "listByUser">) {}
  execute(userId: number): Promise<Category[]> {
    return this.categories.listByUser(userId);
  }
}
