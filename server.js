const express = require("express");
const mercadopago = require("mercadopago");
const path = require("path");

const app = express();

app.use(express.json());
app.use(express.static("public"));

mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN
});

app.post("/create-payment", async (req, res) => {
  try {
    const { amount } = req.body;

    const payment = await mercadopago.payment.create({
      transaction_amount: Number(amount),
      description: "Pagamento de Serviço",
      payment_method_id: "pix",
      payer: {
        email: "cliente@email.com"
      }
    });

    res.json({
      qr_code: payment.body.point_of_interaction.transaction_data.qr_code,
      qr_code_base64: payment.body.point_of_interaction.transaction_data.qr_code_base64
    });

  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando");
});
