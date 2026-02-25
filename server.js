require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");
const QRCode = require("qrcode");

const app = express();

// ==========================
// CONFIGURAÇÕES
// ==========================
const PORT = process.env.PORT || 3000;
const PIXZY_TOKEN = process.env.PIXZY_TOKEN;

if (!PIXZY_TOKEN) {
    console.error("❌ PIXZY_TOKEN não configurado nas variáveis de ambiente.");
    process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

let pagamentos = {};

console.log("🚀 UNLOCKHUB SERVE INICIADO");

// ==========================
// CRIAR PAGAMENTO
// ==========================
app.post("/api/pagar", async (req, res) => {
    try {
        const { nome, email, valor } = req.body;

        if (!nome || !email || !valor) {
            return res.status(400).json({
                ok: false,
                error: "Dados obrigatórios ausentes"
            });
        }

        const valorCentavos = Math.round(Number(valor) * 100);

        // 🔥 Gera webhook dinâmico baseado no domínio atual
        const webhookUrl = `${req.protocol}://${req.get("host")}/api/webhook`;

        const response = await axios.post(
            "https://pay.pixzy.io/api/transactions",
            {
                amount: valorCentavos,
                client_name: nome,
                client_email: email,
                client_doc: "00000000000",
                webhook_url: webhookUrl,
                metadata: {
                    loja: "unlockhub_serve"
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PIXZY_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = response.data.data;

        pagamentos[data.transaction_id] = "pending";

        const qrBase64 = await QRCode.toDataURL(data.br_code);

        return res.json({
            ok: true,
            paymentId: data.transaction_id,
            qrCode: data.br_code,
            qrBase64
        });

    } catch (err) {
        console.error("❌ Erro Pixzy:", err.response?.data || err.message);

        return res.status(500).json({
            ok: false,
            error: "Erro ao criar transação"
        });
    }
});

// ==========================
// STATUS
// ==========================
app.get("/api/status", (req, res) => {
    const { paymentId } = req.query;

    if (!paymentId) {
        return res.status(400).json({ status: "invalid" });
    }

    const status = pagamentos[paymentId] || "pending";
    return res.json({ status });
});

// ==========================
// WEBHOOK
// ==========================
app.post("/api/webhook", (req, res) => {
    const evento = req.body;

    console.log("📩 Webhook recebido:", evento.event);

    if (evento.event === "paid") {
        pagamentos[evento.transaction?.id] = "approved";
        console.log("✅ Pagamento aprovado");
    }

    if (evento.event === "expired") {
        pagamentos[evento.transaction?.id] = "expired";
    }

    if (evento.event === "failed") {
        pagamentos[evento.transaction?.id] = "failed";
    }

    res.sendStatus(200);
});

// ==========================
// START SERVIDOR
// ==========================
app.listen(PORT, () => {
    console.log(`🌍 Servidor rodando na porta ${PORT}`);
});