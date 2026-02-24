document.addEventListener("DOMContentLoaded", function () {

    const campoValor = document.getElementById("valor");

    // ======================
    // Máscara automática 0,00
    // ======================
    campoValor.addEventListener("input", function (e) {

        let value = e.target.value.replace(/\D/g, "");
        value = (parseInt(value || 0, 10) / 100).toFixed(2);
        value = value.replace(".", ",");
        e.target.value = value;
    });

});

// ======================
// GERAR PIX
// ======================
async function gerarPix() {

    const nome = document.getElementById("nome").value.trim();
    const email = document.getElementById("email").value.trim();
    const valorInput = document.getElementById("valor").value;

    if (!nome || !email || !valorInput) {
        alert("Preencha todos os campos");
        return;
    }

    const valorNumerico = parseFloat(valorInput.replace(",", "."));

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
        document.getElementById("qrSection").style.display = "block";

        verificarStatus(data.paymentId);

    } catch (error) {
        console.error(error);
        alert("Erro ao comunicar com servidor");
    }
}

// ======================
// VERIFICAR STATUS
// ======================
function verificarStatus(paymentId) {

    const intervalo = setInterval(async () => {

        const response = await fetch(`/api/status?paymentId=${paymentId}`);
        const data = await response.json();

        if (data.status === "approved") {

            clearInterval(intervalo);

            document.getElementById("container").innerHTML = `
                <div class="success">
                    PAGAMENTO APROVADO ✅
                    <p style="margin-top:10px;color:#888;">
                        Transação confirmada com sucesso.
                    </p>
                </div>
            `;
        }

    }, 3000);
}