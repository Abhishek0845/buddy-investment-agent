export class TimeoutError extends Error {
  constructor(message: string = "Request timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class ApiRateLimitError extends Error {
  constructor(message: string = "API rate limit exceeded") {
    super(message);
    this.name = "ApiRateLimitError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(message: string = "Provider service is unavailable") {
    super(message);
    this.name = "ProviderUnavailableError";
  }
}

export class InvalidTickerError extends Error {
  constructor(message: string = "Invalid stock ticker symbol") {
    super(message);
    this.name = "InvalidTickerError";
  }
}
