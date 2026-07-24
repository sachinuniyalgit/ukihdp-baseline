import type { AppRole } from "@/lib/survey/types";

export interface TestAccount {
  role: AppRole;
  displayName: string;
  email: string;
  password: string;
}

export const testLoginEnabled =
  process.env.NODE_ENV === "development" &&
  process.env.NEXT_PUBLIC_ENABLE_TEST_LOGIN === "true";

const configuredAccounts: TestAccount[] = [
  {
    role: "admin",
    displayName: "Test Administrator",
    email: process.env.NEXT_PUBLIC_TEST_ADMIN_EMAIL ?? "",
    password: process.env.NEXT_PUBLIC_TEST_ADMIN_PASSWORD ?? "",
  },
  {
    role: "researcher",
    displayName: "Test Researcher",
    email: process.env.NEXT_PUBLIC_TEST_RESEARCHER_EMAIL ?? "",
    password: process.env.NEXT_PUBLIC_TEST_RESEARCHER_PASSWORD ?? "",
  },
  {
    role: "supervisor",
    displayName: "Test Supervisor",
    email: process.env.NEXT_PUBLIC_TEST_SUPERVISOR_EMAIL ?? "",
    password: process.env.NEXT_PUBLIC_TEST_SUPERVISOR_PASSWORD ?? "",
  },
  {
    role: "reviewer",
    displayName: "Test Reviewer",
    email: process.env.NEXT_PUBLIC_TEST_REVIEWER_EMAIL ?? "",
    password: process.env.NEXT_PUBLIC_TEST_REVIEWER_PASSWORD ?? "",
  },
  {
    role: "enumerator",
    displayName: "Test Enumerator",
    email: process.env.NEXT_PUBLIC_TEST_ENUMERATOR_EMAIL ?? "",
    password: process.env.NEXT_PUBLIC_TEST_ENUMERATOR_PASSWORD ?? "",
  },
];

export const testAccounts = testLoginEnabled
  ? configuredAccounts.filter((account) => account.email && account.password)
  : [];

export function findTestAccount(email: string, password: string) {
  return testAccounts.find(
    (account) =>
      account.email.toLowerCase() === email.trim().toLowerCase() &&
      account.password === password,
  ) ?? null;
}

export function getTestAccountByRole(role: AppRole) {
  return testAccounts.find((account) => account.role === role) ?? null;
}
