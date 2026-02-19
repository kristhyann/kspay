require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.use(express.static("public"));

const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});

// ==========================
// GERAR PIX
// ==========================
app.post("/pagar", async (req, res) => {

    try {

        if (!req.body.valor || !req.body.email) {
            return res.send("Dados inválidos.");
        }

        const valorLimpo = req.body.valor
            .replace(/\./g, "")
            .replace(",", ".");

        const valorFormatado = Number(valorLimpo);

        if (isNaN(valorFormatado) || valorFormatado <= 0) {
            return res.send("Valor inválido.");
        }

        const payment = new Payment(client);

        const result = await payment.create({
            body: {
                transaction_amount: valorFormatado,
                description: "Pagamento UnlockHub",
                payment_method_id: "pix",
                payer: {
                    email: req.body.email
                }
            }
        });

        const qrBase64 = result.point_of_interaction.transaction_data.qr_code_base64;
        const copiaCola = result.point_of_interaction.transaction_data.qr_code;
        const paymentId = result.id;

        res.redirect(`/pix?qr=${encodeURIComponent(qrBase64)}&code=${encodeURIComponent(copiaCola)}&id=${paymentId}`);

    } catch (error) {
        console.log("ERRO REAL:", error);
        res.send("Erro ao gerar pagamento.");
    }
});

// ==========================
// STATUS PAGAMENTO
// ==========================
app.get("/status/:id", async (req, res) => {
    try {

        const payment = new Payment(client);
        const result = await payment.get({ id: req.params.id });

        res.json({ status: result.status });

    } catch (error) {
        res.json({ status: "erro" });
    }
});

// ==========================
// PÁGINA PIX
// ==========================
app.get("/pix", (req, res) => {

    const { qr, code, id } = req.query;

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Pagamento Pix</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body{background:#0f0f0f;color:white;font-family:Arial;display:flex;justify-content:center;align-items:center;height:100vh}
.card{background:#1a1a1a;padding:40px;border-radius:20px;width:420px;text-align:center;border:1px solid #ff0000;box-shadow:0 0 40px rgba(255,0,0,0.3)}
img{width:230px;margin:20px 0}
textarea{width:100%;height:90px;background:#111;color:white;border:1px solid #333;border-radius:10px;padding:10px}
button{width:100%;padding:15px;margin-top:15px;background:#ff0000;color:white;border:none;border-radius:10px;cursor:pointer}
.spinner{margin:20px auto;width:35px;height:35px;border:4px solid #333;border-top:4px solid red;border-radius:50%;animation:spin 1s linear infinite}
@keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}
.success{color:#00ff88;margin-top:15px;font-weight:bold}
</style>
</head>
<body>

<div class="card">
<h2>Escaneie o QR Code</h2>
<img src="data:image/png;base64,${qr}" />
<textarea id="pixCode" readonly>${code}</textarea>
<button onclick="copiar()">Copiar Código Pix</button>
<div class="spinner"></div>
<p id="status">Aguardando pagamento...</p>
</div>

<script>
function copiar(){
    const text = document.getElementById("pixCode");
    text.select();
    document.execCommand("copy");
    alert("Pix copiado!");
}

setInterval(async () => {
    const response = await fetch("/status/${id}");
    const data = await response.json();
    if(data.status === "approved"){
        document.querySelector(".spinner").style.display = "none";
        document.getElementById("status").innerHTML = "✅ Pagamento Aprovado!";
        document.getElementById("status").classList.add("success");
    }
}, 5000);
</script>

</body>
</html>
`);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});
