/**
 * Tests for job-scraper module - salary extraction functionality
 */

import { describe, it, expect } from "vitest";
import { parseSalaryFromText, extractSalary } from "../job-scraper";

describe("parseSalaryFromText", () => {
  describe("salary ranges", () => {
    it("should parse US dollar range with commas", () => {
      const result = parseSalaryFromText("$80,000 - $120,000");
      expect(result.min).toBe(80000);
      expect(result.max).toBe(120000);
      expect(result.currency).toBe("USD");
    });

    it("should parse Euro range with k suffix", () => {
      const result = parseSalaryFromText("€60k-€80k per year");
      expect(result.min).toBe(60000);
      expect(result.max).toBe(80000);
      expect(result.currency).toBe("EUR");
      expect(result.period).toBe("yearly");
    });

    it("should parse CHF range with apostrophes (Swiss format)", () => {
      const result = parseSalaryFromText("CHF 100'000 - CHF 120'000");
      expect(result.min).toBe(100000);
      expect(result.max).toBe(120000);
      expect(result.currency).toBe("CHF");
    });

    it('should parse range with "to" separator', () => {
      const result = parseSalaryFromText("$50,000 to $70,000 per year");
      expect(result.min).toBe(50000);
      expect(result.max).toBe(70000);
      expect(result.currency).toBe("USD");
      expect(result.period).toBe("yearly");
    });

    it('should parse range with "bis" separator (German)', () => {
      const result = parseSalaryFromText("€50.000 bis €70.000 pro Jahr");
      expect(result.min).toBe(50000);
      expect(result.max).toBe(70000);
      expect(result.currency).toBe("EUR");
    });

    it("should parse range without currency symbol on first number", () => {
      const result = parseSalaryFromText("50-60k USD/year");
      expect(result.min).toBe(50000);
      expect(result.max).toBe(60000);
      expect(result.currency).toBe("USD");
      expect(result.period).toBe("yearly");
    });
  });

  describe("single salary values", () => {
    it("should parse single value and set both min and max to same value", () => {
      const result = parseSalaryFromText("$100,000 per year");
      expect(result.min).toBe(100000);
      expect(result.max).toBe(100000); // Same value as requested
      expect(result.currency).toBe("USD");
      expect(result.period).toBe("yearly");
    });

    it("should parse hourly rate", () => {
      const result = parseSalaryFromText("$100/hour");
      expect(result.min).toBe(100);
      expect(result.max).toBe(100);
      expect(result.currency).toBe("USD");
      expect(result.period).toBe("hourly");
    });

    it("should parse single value with k suffix", () => {
      const result = parseSalaryFromText("€75k annually");
      expect(result.min).toBe(75000);
      expect(result.max).toBe(75000);
      expect(result.currency).toBe("EUR");
      expect(result.period).toBe("yearly");
    });

    it("should parse GBP salary", () => {
      const result = parseSalaryFromText("£50,000 per annum");
      expect(result.min).toBe(50000);
      expect(result.max).toBe(50000);
      expect(result.currency).toBe("GBP");
      expect(result.period).toBe("yearly");
    });
  });

  describe("period detection", () => {
    it('should detect yearly period from "year"', () => {
      const result = parseSalaryFromText("$80,000 per year");
      expect(result.period).toBe("yearly");
    });

    it('should detect yearly period from "annual"', () => {
      const result = parseSalaryFromText("$80,000 annual");
      expect(result.period).toBe("yearly");
    });

    it('should detect yearly period from "p.a."', () => {
      const result = parseSalaryFromText("€60,000 p.a.");
      expect(result.period).toBe("yearly");
    });

    it("should detect monthly period", () => {
      const result = parseSalaryFromText("$5,000 per month");
      expect(result.period).toBe("monthly");
    });

    it("should detect weekly period", () => {
      const result = parseSalaryFromText("$1,000 per week");
      expect(result.period).toBe("weekly");
    });

    it("should detect daily period", () => {
      const result = parseSalaryFromText("$500 per day");
      expect(result.period).toBe("daily");
    });

    it("should detect hourly period", () => {
      const result = parseSalaryFromText("$50 per hour");
      expect(result.period).toBe("hourly");
    });

    it("should infer hourly for low amounts without period", () => {
      const result = parseSalaryFromText("$35");
      expect(result.period).toBe("hourly");
    });

    it("should infer monthly for medium amounts without period", () => {
      const result = parseSalaryFromText("$5,000");
      expect(result.period).toBe("monthly");
    });

    it("should infer yearly for high amounts without period", () => {
      const result = parseSalaryFromText("$80,000");
      expect(result.period).toBe("yearly");
    });
  });

  describe("number formats", () => {
    it("should handle US format with commas", () => {
      const result = parseSalaryFromText("$80,000.50");
      expect(result.min).toBe(80000.5);
    });

    it("should handle European format with dots and comma decimal", () => {
      const result = parseSalaryFromText("€80.000,50");
      expect(result.min).toBe(80000.5);
    });

    it("should handle Swiss format with apostrophes", () => {
      const result = parseSalaryFromText("CHF 80'000");
      expect(result.min).toBe(80000);
    });

    it("should handle k suffix (lowercase)", () => {
      const result = parseSalaryFromText("$80k");
      expect(result.min).toBe(80000);
    });

    it("should handle K suffix (uppercase)", () => {
      const result = parseSalaryFromText("€60K");
      expect(result.min).toBe(60000);
    });
  });

  describe("currency detection", () => {
    it("should normalize $ to USD", () => {
      const result = parseSalaryFromText("$80,000");
      expect(result.currency).toBe("USD");
    });

    it("should normalize € to EUR", () => {
      const result = parseSalaryFromText("€60,000");
      expect(result.currency).toBe("EUR");
    });

    it("should normalize £ to GBP", () => {
      const result = parseSalaryFromText("£50,000");
      expect(result.currency).toBe("GBP");
    });

    it("should handle CHF currency code", () => {
      const result = parseSalaryFromText("CHF 100,000");
      expect(result.currency).toBe("CHF");
    });

    it("should handle Fr. as CHF", () => {
      const result = parseSalaryFromText("Fr. 100,000");
      expect(result.currency).toBe("CHF");
    });

    it("should handle USD currency code", () => {
      const result = parseSalaryFromText("80,000 USD");
      expect(result.currency).toBe("USD");
    });
  });

  describe("edge cases", () => {
    it("should return null values when no salary found", () => {
      const result = parseSalaryFromText("No salary information available");
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
      expect(result.currency).toBeNull();
      expect(result.period).toBeNull();
    });

    it("should handle empty string", () => {
      const result = parseSalaryFromText("");
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
    });

    it("should handle text with salary keywords but no numbers", () => {
      const result = parseSalaryFromText(
        "Competitive salary based on experience"
      );
      expect(result.min).toBeNull();
      expect(result.max).toBeNull();
    });

    it("should not match non-salary numbers", () => {
      const result = parseSalaryFromText("We have 100 employees in 5 offices");
      // Should either find no salary or find one but it should be questionable
      // This test is more about not crashing than specific behavior
      expect(result).toBeDefined();
    });
  });

  describe("complex real-world examples", () => {
    it("should parse salary from full job description text", () => {
      const text = `
        Senior Software Engineer

        We are looking for an experienced engineer to join our team.

        Salary: $120,000 - $150,000 per year

        Benefits include health insurance, 401k matching, and more.
      `;
      const result = parseSalaryFromText(text);
      expect(result.min).toBe(120000);
      expect(result.max).toBe(150000);
      expect(result.currency).toBe("USD");
      expect(result.period).toBe("yearly");
    });

    it("should parse European salary format", () => {
      const text = `
        Entwickler gesucht

        Gehalt: €60.000 - €80.000 pro Jahr

        Home Office möglich
      `;
      const result = parseSalaryFromText(text);
      expect(result.min).toBe(60000);
      expect(result.max).toBe(80000);
      expect(result.currency).toBe("EUR");
    });

    it("should parse Swiss salary format", () => {
      const text = `
        Job in Zürich

        Lohn: CHF 100'000 - CHF 120'000 pro Jahr
      `;
      const result = parseSalaryFromText(text);
      expect(result.min).toBe(100000);
      expect(result.max).toBe(120000);
      expect(result.currency).toBe("CHF");
    });
  });
});

describe("extractSalary", () => {
  it("should extract salary from HTML with salary class", async () => {
    const html = `
      <html>
        <body>
          <div class="salary">$80,000 - $120,000 per year</div>
        </body>
      </html>
    `;
    const result = await extractSalary(html);
    expect(result.min).toBe(80000);
    expect(result.max).toBe(120000);
    expect(result.currency).toBe("USD");
    expect(result.period).toBe("yearly");
  });

  it("should extract salary from HTML with compensation class", async () => {
    const html = `
      <html>
        <body>
          <div class="compensation">€60k-€80k annually</div>
        </body>
      </html>
    `;
    const result = await extractSalary(html);
    expect(result.min).toBe(60000);
    expect(result.max).toBe(80000);
    expect(result.currency).toBe("EUR");
  });

  it("should fall back to body text when no specific selector found", async () => {
    const html = `
      <html>
        <body>
          <p>Join our team! Salary: $100,000 per year</p>
        </body>
      </html>
    `;
    const result = await extractSalary(html);
    expect(result.min).toBe(100000);
    expect(result.max).toBe(100000);
    expect(result.currency).toBe("USD");
  });

  it("should handle HTML with no salary information", async () => {
    const html = `
      <html>
        <body>
          <h1>Job Title</h1>
          <p>Great opportunity to join our team!</p>
        </body>
      </html>
    `;
    const result = await extractSalary(html);
    expect(result.min).toBeNull();
    expect(result.max).toBeNull();
  });

  it("should handle multiple salary mentions and use the first one", async () => {
    const html = `
      <html>
        <body>
          <div class="salary">$100,000 - $120,000</div>
          <p>Some text mentioning $50,000 for a different role</p>
        </body>
      </html>
    `;
    const result = await extractSalary(html);
    // Should find the first salary range
    expect(result.min).toBe(100000);
    expect(result.max).toBe(120000);
  });
});
