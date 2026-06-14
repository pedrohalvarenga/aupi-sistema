ALTER TABLE public.hospedagens ADD COLUMN IF NOT EXISTS status_pagamento TEXT NOT NULL DEFAULT 'pendente' CHECK (status_pagamento IN ('pendente','pago'));
