const express = require("express");
const path = require("path");

const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();
app.use(express.json());
app.use(express.static("public"));

// 🔐 Configuração Mercado Pago (VERSÃO NOVA)
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN
});

const payment = new Payment(client);

// 🔥 Criar pagamento PIX
app.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body;

    const result = await payment.create({
      body: {
        transaction_amount: Number(amount),
        description: "Pagamento via PIX",
        payment_method_id: "pix",
        payer: {
          email: "cliente@email.com"
        }
      }
    });

    const qrData = result.point_of_interaction.transaction_data;

    res.json({
      qr_code: qrData.qr_code,
      qr_code_base64: qrData.qr_code_base64
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});