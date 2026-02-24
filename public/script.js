// ==============================
// FORMATAÇÃO AUTOMÁTICA 0,00
// ==============================
const campoValor = document.getElementById("valor");

campoValor.addEventListener("input", function (e) {

    let value = e.target.value.replace(/\D/g, "");

    value = (parseInt(value || 0, 10) / 100).toFixed(2);

    value = value.replace(".", ",");

    e.target.value = value;
});

// ==============================
// GERAR PIX
// ==============================
async function gerarPix() {

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const valorInput = document.getElementById("valor").value;

    if (!nome || !email || !valorInput) {
        alert("Preencha todos os campos");
        return;
    }

    const valorNumerico = parseFloat(
        valorInput.replace(",", ".")
    );

    try {

        const response = await fetch("/api/pagar", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                nome,
                email,
                valor: valorNumerico
            })
        });

        const data = await response.json();

        if (!data.ok) {
            alert("Erro ao gerar Pix");
            return;
        }

        document.getElementById("qrImage").src = data.qrBase64;
        document.getElementById("pixCode").value = data.qrCode;

        verificarStatus(data.paymentId);

    } catch (error) {
        alert("Erro na requisição");
    }
}

// ==============================
// VERIFICAR STATUS
// ==============================
function verificarStatus(paymentId) {

    const intervalo = setInterval(async () => {

        const response = await fetch(`/api/status?paymentId=${paymentId}`);
        const data = await response.json();

        if (data.status === "approved") {
            clearInterval(intervalo);
            mostrarAprovado();
        }

    }, 3000);
}

// ==============================
// TELA APROVADO
// ==============================
function mostrarAprovado() {

    const container = document.getElementById("container");

    container.innerHTML = `
        <div style="text-align:center;">
            <h2 style="color:#00ff88; font-size:28px;">
                PAGAMENTO APROVADO ✅
            </h2>
            <p style="color:#fff;">Seu pagamento foi confirmado com sucesso.</p>
        </div>
    `;
}