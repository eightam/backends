CREATE TABLE invoices (
  sequence integer,
  prefix text,
  "paymentId" uuid NOT NULL REFERENCES payments(id),
  data jsonb,
  "createdAt" timestamp with time zone DEFAULT now(),
  CONSTRAINT invoices_pkey PRIMARY KEY (sequence, prefix)
);

CREATE UNIQUE INDEX invoices_pkey ON invoices(sequence int4_ops,prefix text_ops);
