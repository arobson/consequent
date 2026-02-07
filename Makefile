.PHONY: help clean build test coverage release

help: ## Display available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-15s\033[0m %s\n", $$1, $$2}'

clean: ## Remove build artifacts
	rm -rf dist coverage

build: clean ## Compile TypeScript
	npx tsc

test: ## Run tests
	npx vitest run

coverage: ## Run tests with coverage
	npx vitest run --coverage

release: build test ## Build, test, and bump version
	npx standard-version
