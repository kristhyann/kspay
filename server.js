require("dotenv").config();
const express = require("express");
const axios = require("axios");
const path = require("path");

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const PORT = process.env.PORT || 10000;
const PIXZY_TOKEN = process.env.PIXZY_TOKEN;

let pagamentos = {}; // memória simples para status

console.log("VERSAO PIXZY ATIVA");

// ==========================
// CRIAR PAGAMENTO
// ==========================
app.post("/api/pagar", async (req, res) => {

    try {

        const { nome, email, valor } = req.body;

        const valorCentavos = Math.round(parseFloat(valor) * 100);

        const response = await axios.post(
            "https://pay.pixzy.io/api/transactions",
            {
                amount: valorCentavos,
                client_name: nome,
                client_email: email,
                client_doc: "00000000000", // pode ajustar depois
                webhook_url: "https://kspay.onrender.com/api/webhook",
                metadata: {
                    origem: "unlockhub"
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

        res.json({
            ok: true,
            paymentId: data.transaction_id,
            qrCode: data.br_code
        });

    } catch (err) {

        console.log("Erro Pixzy:", err.response?.data || err.message);

        res.status(500).json({
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

    const status = pagamentos[paymentId] || "pending";

    res.json({ status });
});

// ==========================
// WEBHOOK
// ==========================
app.post("/api/webhook", (req, res) => {

    const evento = req.body;

    if (evento.event === "paid") {

        const id = evento.transaction?.id;

        pagamentos[id] = "approved";

        console.log("Pagamento aprovado:", id);
    }

    if (evento.event === "expired") {

        const id = evento.transaction?.id;

        pagamentos[id] = "expired";

        console.log("Pagamento expirado:", id);
    }

    res.sendStatus(200);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});