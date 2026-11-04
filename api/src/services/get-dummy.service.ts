import type { Dummy, DummyRepository } from "../repositories/postgres/dummy.repository.js";

export class GetDummyService {
  constructor(private readonly dummies: DummyRepository) {}

  execute(id: number): Promise<Dummy | null> {
    return this.dummies.findById(id);
  }
}
