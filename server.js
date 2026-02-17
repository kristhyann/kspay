const express = require("express");
const bodyParser = require("body-parser");
const mercadopago = require("mercadopago");
const cors = require("cors");

const app = express();

app.use(bodyParser.json());
app.use(express.static("public"));
app.use(cors());

// 🔐 Token via variável de ambiente
mercadopago.configure({
  access_token: process.env.MP_ACCESS_TOKEN,
});

// ✅ Criar pagamento Pix
app.post("/criar-pagamento", async (req, res) => {
  try {
    const { nome, whatsapp, aparelho, servico, email, valor } = req.body;

    const payment_data = {
      transaction_amount: Number(valor),
      description: `Serviço: ${servico} - ${aparelho}`,
      payment_method_id: "pix",
      payer: {
        email: email,
        first_name: nome,
      },
    };

    const pagamento = await mercadopago.payment.create(payment_data);

    res.json({
      id: pagamento.body.id,
      qr_code:
        pagamento.body.point_of_interaction.transaction_data.qr_code,
      qr_base64:
        pagamento.body.point_of_interaction.transaction_data.qr_code_base64,
    });

  } catch (error) {
    console.error("ERRO AO CRIAR PAGAMENTO:", error);
    res.status(500).json({ error: "Erro ao criar pagamento" });
  }
});

// ✅ Verificar status do pagamento
app.get("/status/:id", async (req, res) => {
  try {
    const pagamento = await mercadopago.payment.findById(req.params.id);

    res.json({
      status: pagamento.body.status,
    });

  } catch (error) {
    console.error("ERRO AO VERIFICAR STATUS:", error);
    res.status(500).json({ error: "Erro ao verificar status" });
  }
});

// 🚀 Iniciar servidor
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("Servidor rodando na porta " + PORT);
});
