// test-ifood.js
const CLIENT_ID = "5db598fc-f0e5-4a4b-bb1e-d025244c2394"
const CLIENT_SECRET = "gglqx9fga793a1finnfqbqfdq17m8x5w2jmataegbbdfbeqox24ifoscpda04xxv0kun97ep1ae2n6b14h919gyk191x0fpwk8b"

// 1. Gera token
const authRes = await fetch("https://merchant-api.ifood.com.br/authentication/v1.0/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: `grantType=client_credentials&clientId=${CLIENT_ID}&clientSecret=${CLIENT_SECRET}`
})
const { accessToken } = await authRes.json()
console.log("Token OK:", accessToken.substring(0, 30) + "...")

// 2. Busca eventos
const eventsRes = await fetch("https://merchant-api.ifood.com.br/order/v1.0/events:polling", {
  headers: { Authorization: `Bearer ${accessToken}` }
})
const events = await eventsRes.json()
console.log("Eventos:", JSON.stringify(events, null, 2))