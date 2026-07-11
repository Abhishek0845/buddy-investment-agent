export class TestService {
  public static getGreeting(name: string = "World"): string {
    return `Hello, ${name}! This is a temporary test service.`;
  }

  public static add(a: number, b: number): number {
    return a + b;
  }
}
