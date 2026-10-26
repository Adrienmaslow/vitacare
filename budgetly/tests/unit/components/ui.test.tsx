// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Money } from "@/components/ui/money";
import { Field, MoneyInput } from "@/components/ui/form-controls";
import { EmptyState, ProgressBar } from "@/components/ui/misc";
import { Wallet } from "lucide-react";

describe("composants UI", () => {
  it("Money formate et colore selon le signe", () => {
    render(<Money value={-1250} colored sign />);
    const el = screen.getByText(/12,50/);
    expect(el.textContent).toBe("-12,50 €");
    expect(el.className).toContain("text-danger");
  });

  it("Field relie le label et annonce l'erreur", () => {
    render(<Field label="Montant" htmlFor="m" error="Montant invalide"><MoneyInput id="m" /></Field>);
    expect(screen.getByLabelText("Montant")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Montant invalide");
  });

  it("ProgressBar expose une valeur accessible bornée", () => {
    render(<ProgressBar value={140} label="Budget courses" />);
    const bar = screen.getByRole("progressbar", { name: "Budget courses" });
    expect(bar).toHaveAttribute("aria-valuenow", "100");
  });

  it("EmptyState explique quoi faire", () => {
    render(<EmptyState icon={Wallet} title="Aucun compte" description="Ajoute ton premier compte." />);
    expect(screen.getByText("Aucun compte")).toBeInTheDocument();
  });
});
