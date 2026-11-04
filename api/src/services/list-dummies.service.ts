import type { Dummy, DummyRepository } from "../repositories/postgres/dummy.repository.js";

export class ListDummiesService {
  constructor(private readonly dummies: DummyRepository) {}

  execute(): Promise<Dummy[]> {
    return this.dummies.findAll();
  }
}
