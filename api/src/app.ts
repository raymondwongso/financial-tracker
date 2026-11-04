import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import jwt from "@fastify/jwt";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import type { Config } from "./config.js";
import { AppError } from "./errors.js";
import { COOKIE_NAME } from "./lib/auth.js";
import { accountsController } from "./controllers/accounts.controller.js";
import { authController } from "./controllers/auth.controller.js";
import { categoriesController } from "./controllers/categories.controller.js";
import { dashboardController } from "./controllers/dashboard.controller.js";
import { investmentAccountsController } from "./controllers/investment-accounts.controller.js";
import { healthController } from "./controllers/health.controller.js";
import { transactionsController } from "./controllers/transactions.controller.js";
import { AccountRepository } from "./repositories/postgres/account.repository.js";
import { CategoryRepository } from "./repositories/postgres/category.repository.js";
import { InvestmentAccountRepository } from "./repositories/postgres/investment-account.repository.js";
import { InvestmentPriceRepository } from "./repositories/postgres/investment-price.repository.js";
import { InvestmentTransactionRepository } from "./repositories/postgres/investment-transaction.repository.js";
import { createPool } from "./repositories/postgres/pool.js";
import { TransactionRepository } from "./repositories/postgres/transaction.repository.js";
import { UserRepository } from "./repositories/postgres/user.repository.js";
import { CreateAccountService } from "./services/create-account.service.js";
import { CreateTransactionService } from "./services/create-transaction.service.js";
import { DeleteAccountService } from "./services/delete-account.service.js";
import { DeleteInvestmentAccountService } from "./services/delete-investment-account.service.js";
import { DeleteTransactionService } from "./services/delete-transaction.service.js";
import { DeleteInvestmentTransactionService } from "./services/delete-investment-transaction.service.js";
import { GetAccountService } from "./services/get-account.service.js";
import { GetAccountSummaryService } from "./services/get-account-summary.service.js";
import { GetCurrentUserService } from "./services/get-current-user.service.js";
import { GetDashboardSummaryService } from "./services/get-dashboard-summary.service.js";
import { GetTotalAssetsService } from "./services/get-total-assets.service.js";
import { CreateInvestmentAccountService } from "./services/create-investment-account.service.js";
import { CreateInvestmentTransactionService } from "./services/create-investment-transaction.service.js";
import { GetInvestmentAccountService } from "./services/get-investment-account.service.js";
import { ListInvestmentAccountsService } from "./services/list-investment-accounts.service.js";
import { ListInvestmentTransactionsService } from "./services/list-investment-transactions.service.js";
import { ListInvestmentPriceHistoryService } from "./services/list-investment-price-history.service.js";
import { SetInvestmentPriceService } from "./services/set-investment-price.service.js";
import { GetOrCreateCategoryService } from "./services/get-or-create-category.service.js";
import { ListAccountsService } from "./services/list-accounts.service.js";
import { ListCategoriesService } from "./services/list-categories.service.js";
import { ListTransactionsService } from "./services/list-transactions.service.js";
import { LoginUserService } from "./services/login-user.service.js";
import { RegisterUserService } from "./services/register-user.service.js";

export function buildApp(config: Config) {
  const app = Fastify({
    logger: { level: config.logLevel },
    trustProxy: config.trustProxy,
  });

  app.register(cors, { origin: config.corsOrigin, credentials: true });
  app.register(helmet);
  app.register(rateLimit, { global: false });
  app.register(cookie);
  app.register(jwt, { secret: config.jwtSecret, cookie: { cookieName: COOKIE_NAME, signed: false } });

  app.setErrorHandler((err: Error & { statusCode?: number; validation?: unknown }, request, reply) => {
    if (err instanceof AppError) return reply.code(err.statusCode).send({ error: err.message });
    if (err.validation) return reply.code(400).send({ error: err.message });
    if (err.statusCode && err.statusCode < 500) {
      return reply.code(err.statusCode).send({ error: err.message });
    }
    request.log.error(err);
    return reply.code(500).send({ error: "Internal server error" });
  });

  // database
  const pool = createPool(config);
  app.addHook("onClose", async () => {
    await pool.end();
  });

  // repositories
  const users = new UserRepository(pool);
  const accounts = new AccountRepository(pool);
  const categories = new CategoryRepository(pool);
  const transactions = new TransactionRepository(pool);
  const investmentAccounts = new InvestmentAccountRepository(pool);
  const investmentTransactions = new InvestmentTransactionRepository(pool);
  const investmentPrices = new InvestmentPriceRepository(pool);

  // services

  // controllers / routes
  app.register(healthController(config), { prefix: "/api" });
  app.register(
    authController({
      registerUser: new RegisterUserService(users),
      loginUser: new LoginUserService(users),
      getCurrentUser: new GetCurrentUserService(users),
      cookieSecure: config.cookieSecure,
    }),
    { prefix: "/api" },
  );
  app.register(
    accountsController({
      listAccounts: new ListAccountsService(accounts),
      getAccount: new GetAccountService(accounts),
      deleteAccount: new DeleteAccountService(accounts),
      createAccount: new CreateAccountService(accounts),
      listTransactions: new ListTransactionsService(accounts, transactions),
      getAccountSummary: new GetAccountSummaryService(accounts, transactions),
    }),
    { prefix: "/api" },
  );
  app.register(
    categoriesController({
      listCategories: new ListCategoriesService(categories),
      getOrCreateCategory: new GetOrCreateCategoryService(categories),
    }),
    { prefix: "/api" },
  );
  app.register(
    transactionsController({
      createTransaction: new CreateTransactionService(accounts, categories, transactions),
      deleteTransaction: new DeleteTransactionService(transactions),
    }),
    { prefix: "/api" },
  );
  app.register(
    dashboardController({
      getDashboardSummary: new GetDashboardSummaryService(accounts),
      getTotalAssets: new GetTotalAssetsService(accounts, investmentAccounts),
    }),
    { prefix: "/api" },
  );

  app.register(
    investmentAccountsController({
      listAccounts: new ListInvestmentAccountsService(investmentAccounts),
      getAccount: new GetInvestmentAccountService(investmentAccounts),
      createAccount: new CreateInvestmentAccountService(investmentAccounts),
      setPrice: new SetInvestmentPriceService(investmentAccounts),
      listPriceHistory: new ListInvestmentPriceHistoryService(investmentAccounts, investmentPrices),
      listTransactions: new ListInvestmentTransactionsService(investmentAccounts, investmentTransactions),
      createTransaction: new CreateInvestmentTransactionService(investmentTransactions),
      deleteAccount: new DeleteInvestmentAccountService(investmentAccounts),
      deleteTransaction: new DeleteInvestmentTransactionService(investmentTransactions),
    }),
    { prefix: "/api" },
  );

  return app;
}
