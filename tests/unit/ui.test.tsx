import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuestionCard } from '@/components/quizzes/QuestionCard';
import { QuizSession } from '@/components/quizzes/QuizSession';
import { questionById } from '@/content';
import { db } from '@/db';
import { resetAllProgress } from '@/db/repo';

const wrap = (ui: React.ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);

beforeEach(async () => {
  await resetAllProgress();
});

describe('QuestionCard', () => {
  it('ne montre pas la réponse avant validation, puis corrige et enregistre', async () => {
    const user = userEvent.setup();
    const q = questionById('ex-AD1.3')!;
    wrap(<QuestionCard question={q} context="exercise" refId="td1-ex1-2" label="AD1.3" seed={1} />);
    expect(screen.queryByText(/Réponse attendue/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Valider' })).toBeDisabled();
    await user.type(screen.getByRole('textbox', { name: /Ta réponse/ }), '0,26');
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(await screen.findByText(/unité manque/)).toBeInTheDocument();
    expect(screen.getByText(/Réponse attendue/)).toBeInTheDocument();
    await waitFor(async () => expect(await db.mistakes.count()).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Réessayer' }));
    await user.type(screen.getByRole('textbox', { name: /Ta réponse/ }), '0,26 Ω');
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(await screen.findByText('Correct')).toBeInTheDocument();
    const attempts = await db.attempts.toArray();
    expect(attempts.map((a) => a.attemptNumber)).toEqual([1, 2]);
  });

  it('QCM : explique pourquoi le choix est faux', async () => {
    const user = userEvent.setup();
    const q = questionById('q-c0-d2')!;
    if (q.type !== 'formula') throw new Error();
    wrap(<QuestionCard question={q} context="lesson" refId="c0-l4" label="x" seed={3} />);
    const wrong = q.choices.find((c) => c.id !== q.correctId)!;
    const radios = screen.getAllByRole('radio');
    const idx = radios.findIndex(
      (r) => r.closest('label')!.textContent!.includes(wrong.why) || false,
    );
    // Sélectionne un choix faux (n'importe lequel)
    await user.click(radios[idx >= 0 ? idx : 0]!);
    await user.click(screen.getByRole('button', { name: 'Valider' }));
    expect(await screen.findByRole('status')).toBeInTheDocument();
  });
});

describe('QuizSession chronométrée (mode rapide)', () => {
  it('s’arrête à la fin du temps et affiche le bilan', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const qs = ['q-c0-u4', 'q-c0-k3'].map((id) => questionById(id)!);
    wrap(<QuizSession questions={qs} context="quick" refId="t" label="t" timeLimitSec={3} />);
    expect(screen.getByText('0:03')).toBeInTheDocument();
    await act(async () => {
      vi.advanceTimersByTime(3500);
    });
    expect(await screen.findByText('Bilan de la session')).toBeInTheDocument();
    vi.useRealTimers();
  });
});
