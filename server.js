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


// 🔥 CRIAR PAGAMENTO PIX
app.post("/pagar", async (req, res) => {
    try {

        const payment = new Payment(client);

        const result = await payment.create({
            body: {
                transaction_amount: Number(req.body.valor),
                description: "Pagamento UnlockHub",
                payment_method_id: "pix",
                payer: {
                    email: req.body.email || "cliente@email.com"
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


// 🔥 VERIFICAR STATUS DO PAGAMENTO
app.get("/status/:id", async (req, res) => {
    try {

        const payment = new Payment(client);
        const result = await payment.get({ id: req.params.id });

        res.json({ status: result.status });

    } catch (error) {
        res.json({ status: "erro" });
    }
});


// 🔥 PÁGINA PIX PREMIUM
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
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;500;700&display=swap" rel="stylesheet">
<style>

*{margin:0;padding:0;box-sizing:border-box;font-family:'Poppins',sans-serif}

body{
background:linear-gradient(135deg,#0f0f0f,#1a1a1a);
height:100vh;
display:flex;
justify-content:center;
align-items:center;
color:white;
}

.card{
background:#141414;
padding:40px;
border-radius:20px;
width:420px;
text-align:center;
box-shadow:0 0 60px rgba(255,0,0,0.25);
border:1px solid rgba(255,0,0,0.3);
}

h2{
margin-bottom:15px;
font-weight:600;
}

.qr{
width:220px;
margin:20px auto;
}

textarea{
width:100%;
height:80px;
border-radius:10px;
border:none;
padding:10px;
background:#1f1f1f;
color:white;
resize:none;
}

button{
width:100%;
padding:12px;
margin-top:10px;
border-radius:10px;
border:none;
cursor:pointer;
font-weight:600;
transition:0.3s;
}

.copy{
background:#ff0000;
color:white;
}

.copy:hover{
background:#cc0000;
}

.loading{
margin-top:15px;
font-size:14px;
color:#aaa;
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
background:#0f2f1f;
border:1px solid #00ff88;
box-shadow:0 0 40px rgba(0,255,136,0.5);
}

</style>
</head>
<body>

<div class="card" id="card">

<h2>Escaneie o QR Code</h2>

<img class="qr" src="data:image/png;base64,${qr}" />

<textarea id="pixCode" readonly>${code}</textarea>

<button class="copy" onclick="copiar()">Copiar Código Pix</button>

<div class="spinner"></div>
<div class="loading">Aguardando pagamento...</div>

</div>

<script>

function copiar(){
const text = document.getElementById("pixCode");
text.select();
document.execCommand("copy");
alert("Pix copiado!");
}

// 🔥 VERIFICA PAGAMENTO AUTOMÁTICO
setInterval(async () => {

    const response = await fetch("/status/${paymentId}");
    const data = await response.json();

    if(data.status === "approved"){

        const card = document.getElementById("card");
        card.classList.add("success");

        card.innerHTML = \`
            <h2>✅ Pagamento Aprovado</h2>
            <p style="margin-top:15px;color:#00ff88;">
            Seu pagamento foi confirmado com sucesso.
            </p>
        \`;

    }

}, 5000);

</script>

</body>
</html>
`);
});


app.listen(3000, () => console.log("Servidor rodando na porta 3000"));