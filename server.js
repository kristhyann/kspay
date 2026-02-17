const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");

const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));
app.use(cors());

// 🔐 Configuração nova SDK
const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN,
});

const payment = new Payment(client);

// ✅ Criar pagamento Pix
app.post("/criar-pagamento", async (req, res) => {
  try {
    const { nome, aparelho, servico, email, valor } = req.body;

    const body = {
      transaction_amount: Number(valor),
      description: `Serviço: ${servico} - ${aparelho}`,
      payment_method_id: "pix",
      payer: {
        email: email,
      },
    };

    const result = await payment.create({ body });

    res.json({
      id: result.id,
      qr_code: result.point_of_interaction.transaction_data.qr_code,
      qr_base64:
        result.point_of_interaction.transaction_data.qr_code_base64,
    });

  } catch (error) {
    console.error("ERRO AO CRIAR PAGAMENTO:", error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// ✅ Verificar status
app.get("/status/:id", async (req, res) => {
  try {
    const result = await payment.get({
      id: req.params.id,
    });

    res.json({
      status: result.status,
    });

  } catch (error) {
    console.error("ERRO AO VERIFICAR STATUS:", error);
    res.status(500).json({ error: "Erro ao verificar status" });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
