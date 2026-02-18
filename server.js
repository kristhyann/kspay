require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { MercadoPagoConfig, Payment } = require("mercadopago");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// 🔥 SERVIR ARQUIVOS DA PASTA PUBLIC
app.use(express.static("public"));

// 🔥 CONFIGURAR MERCADO PAGO
const client = new MercadoPagoConfig({
    accessToken: process.env.MP_ACCESS_TOKEN
});


// ==============================
// 🔥 ROTA PARA GERAR PIX
// ==============================
app.post("/pagar", async (req, res) => {
    try {

        const payment = new Payment(client);

        const result = await payment.create({
            body: {
                transaction_amount: Number(req.body.valor),
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
        console.log(error);
        res.send("Erro ao gerar pagamento.");
    }
});


// ==============================
// 🔥 VERIFICAR STATUS DO PAGAMENTO
// ==============================
app.get("/status/:id", async (req, res) => {
    try {
        const payment = new Payment(client);
        const result = await payment.get({ id: req.params.id });

        res.json({ status: result.status });

    } catch (error) {
        res.json({ status: "erro" });
    }
});


// ==============================
// 🔥 PÁGINA PIX PREMIUM
// ==============================
app.get("/pix", (req, res) => {

    const qr = req.query.qr;
    const code = req.query.code;
    const paymentId = req.query.id;

    res.send(`
<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Pagamento Pix</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>

*{margin:0;padding:0;box-sizing:border-box;font-family:Arial,sans-serif}

body{
background:#0f0f0f;
display:flex;
justify-content:center;
align-items:center;
height:100vh;
color:white;
}

.card{
background:#1a1a1a;
padding:35px;
border-radius:15px;
width:400px;
text-align:center;
box-shadow:0 0 40px rgba(255,0,0,0.3);
border:1px solid rgba(255,0,0,0.2);
}

.qr{
width:220px;
margin:20px auto;
}

textarea{
width:100%;
height:80px;
background:#111;
color:white;
border:1px solid #333;
border-radius:8px;
padding:10px;
resize:none;
}

button{
width:100%;
padding:12px;
margin-top:10px;
background:#ff0000;
color:white;
border:none;
border-radius:8px;
cursor:pointer;
font-weight:bold;
}

button:hover{
background:#cc0000;
}

.spinner{
margin:15px auto;
width:30px;
height:30px;
border:4px solid #333;
border-top:4px solid red;
border-radius:50%;
animation:spin 1s linear infinite;
}

@keyframes spin{
0%{transform:rotate(0deg)}
100%{transform:rotate(360deg)}
}

.success{
color:#00ff88;
margin-top:15px;
font-weight:bold;
}

</style>
</head>
<body>

<div class="card" id="card">

<h2>Escaneie o QR Code</h2>

<img class="qr" src="data:image/png;base64,${qr}" />

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

    const response = await fetch("/status/${paymentId}");
    const data = await response.json();

    if(data.status === "approved"){
        document.getElementById("status").innerHTML = "✅ Pagamento Aprovado!";
    }

}, 5000);

</script>

</body>
</html>
`);
});


// ==============================
// 🔥 INICIAR SERVIDOR
// ==============================
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log("Servidor rodando na porta " + PORT);
});