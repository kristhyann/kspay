require("dotenv").config();

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { z } = require("zod");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

const PORT = process.env.PORT || 3000;
const MP_ACCESS_TOKEN = process.env.MP_ACCESS_TOKEN;

if (!MP_ACCESS_TOKEN) {
  throw new Error("MP_ACCESS_TOKEN não configurado no .env");
}

const mpClient = new MercadoPagoConfig({
  accessToken: MP_ACCESS_TOKEN,
});

const paymentClient = new Payment(mpClient);

app.set("trust proxy", 1);

app.use(helmet());
app.use(express.json({ limit: "50kb" }));
app.use(express.urlencoded({ extended: true, limit: "50kb" }));
app.use(express.static(path.join(__dirname, "public")));

const payLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  message: { ok: false, error: "Muitas tentativas. Tente novamente mais tarde." },
});

const statusLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { ok: false, error: "Muitas consultas. Aguarde um pouco." },
});

/*
  Normaliza valor:
  aceita "50", "50.00", "50,00"
*/
function normalizeValor(v) {
  if (typeof v === "string") {
    v = v.replace(",", ".");
  }
  return Number(v);
}

const PaySchema = z.object({
  nome: z.string().min(2).max(80),
  email: z.string().email().max(120),
  whatsapp: z.string().min(8).max(20),
  servico: z.string().min(2).max(120),
  valor: z.any(),
});

app.post("/api/pagar", payLimiter, async (req, res) => {
  const parsed = PaySchema.safeParse(req.body);

  if (!parsed.success) {
    console.log("Erro validação Zod:", parsed.error.issues);
    return res.status(400).json({
      ok: false,
      error: "Dados inválidos",
    });
  }

  let { nome, email, whatsapp, servico, valor } = parsed.data;

  valor = normalizeValor(valor);

  if (!valor || isNaN(valor) || valor <= 0 || valor > 100000) {
    return res.status(400).json({
      ok: false,
      error: "Valor inválido",
    });
  }

  try {
    const result = await paymentClient.create({
      body: {
        transaction_amount: valor,
        description: `${servico} - ${nome} (${whatsapp})`,
        payment_method_id: "pix",
        payer: {
          email,
        },
        metadata: {
          nome,
          whatsapp,
          servico,
        },
      },
    });

    const paymentId = result.id;
    const tx = result.point_of_interaction?.transaction_data || {};

    return res.json({
      ok: true,
      paymentId,
      status: result.status,
      qrCode: tx.qr_code,
      qrBase64: tx.qr_code_base64,
    });
  } catch (err) {
    console.error("Erro ao gerar pagamento:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao gerar pagamento.",
    });
  }
});

app.get("/api/status", statusLimiter, async (req, res) => {
  const paymentId = req.query.paymentId;

  if (!paymentId) {
    return res.status(400).json({
      ok: false,
      error: "paymentId é obrigatório",
    });
  }

  try {
    const result = await paymentClient.get({ id: paymentId });

    return res.json({
      ok: true,
      paymentId,
      status: result.status,
    });
  } catch (err) {
    console.error("Erro ao consultar status:", err);
    return res.status(500).json({
      ok: false,
      error: "Erro ao consultar status.",
    });
  }
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log("VERSAO NOVA ATIVA");
  console.log(`✅ Servidor rodando na porta ${PORT}`);
});