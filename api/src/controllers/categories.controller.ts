import type { FastifyInstance } from "fastify";
import type { CreateCategoryRequest } from "@financialtracker/shared";
import { authenticate } from "../lib/auth.js";
import type { GetOrCreateCategoryService } from "../services/get-or-create-category.service.js";
import type { ListCategoriesService } from "../services/list-categories.service.js";

interface Deps {
  listCategories: Pick<ListCategoriesService, "execute">;
  getOrCreateCategory: Pick<GetOrCreateCategoryService, "execute">;
}

export function categoriesController({ listCategories, getOrCreateCategory }: Deps) {
  return async (app: FastifyInstance) => {
    app.addHook("onRequest", authenticate);

    app.get("/categories", async (request) => listCategories.execute(request.user.id));

    app.post<{ Body: CreateCategoryRequest }>(
      "/categories",
      {
        schema: {
          body: {
            type: "object",
            required: ["name"],
            properties: { name: { type: "string", maxLength: 100 } },
          },
        },
      },
      async (request) => getOrCreateCategory.execute(request.user.id, request.body.name),
    );
  };
}
