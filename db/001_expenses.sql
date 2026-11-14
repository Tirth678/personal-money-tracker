CREATE TABLE IF NOT EXISTS expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  amount_cents bigint NOT NULL CHECK (amount_cents > 0 AND amount_cents <= 99999999999),
  category text NOT NULL CHECK (category IN ('unknown','food','waste','needs','tech','self')),
  note varchar(160) NOT NULL DEFAULT '',
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS expenses_spent_on_idx ON expenses (spent_on DESC, created_at DESC);
