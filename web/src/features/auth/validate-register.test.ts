import { describe, expect, it } from "vitest";
import { validateRegister } from "./validate-register";

const ok = { email: "a@b.co", firstName: "A", lastName: "B", password: "password1", confirm: "password1" };

describe("validateRegister", () => {
  it("accepts a valid form", () => {
    expect(validateRegister(ok)).toEqual({});
  });
  it("reports each invalid field", () => {
    const e = validateRegister({ email: "x", firstName: " ", lastName: "", password: "short", confirm: "other" });
    expect(Object.keys(e).sort()).toEqual(["confirm", "email", "firstName", "lastName", "password"]);
  });
  it("requires matching confirmation", () => {
    expect(validateRegister({ ...ok, confirm: "password2" })).toEqual({ confirm: "Passwords do not match" });
  });
});
