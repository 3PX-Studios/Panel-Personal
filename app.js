const db = supabase.createClient("https://ruxxqhwrezrvvfwkbiyx.supabase.co", "sb_publishable_Di3cYbfS3eNOka_lj0SiQQ_Wg7kVfCd")

const exitConfigButton = document.getElementById("exit-config")
const configButton = document.getElementById("config")
const logoutButton = document.getElementById("logout")

const loginSection = document.getElementById("login-section")
const formLogin = document.getElementById("form-login")
const emailInput = document.getElementById("email")
const passwordInput = document.getElementById("password")
const loginButton = document.getElementById("login-button")
const loginErrorText = document.getElementById("login-error")

const redeemSection = document.getElementById("redeem-section")
const formCode = document.getElementById("form-redeemed-code")
const codeOutcome = document.getElementById("code-outcome")
const codeInput = document.getElementById("code")
const codeButton = document.getElementById("code-button")
const errors = {
  ya_usado: "✗ Ya usado",
  vencido: "✗ Vencido",
  no_existe: "✗ No existe",
  sin_conexion: "✗ Sin conexion"
}

const todaySection = document.getElementById("today-section")
const todayMinigame = document.getElementById("minigame")
const todayPlays = document.getElementById("plays")
const todayWins = document.getElementById("wins")
const todayRedeems = document.getElementById("redeemed")

const configSection = document.getElementById("config-section")
const formConfig = document.getElementById("form-config")
const modeSelect = document.getElementById("mode")
const manualSelect = document.getElementById("manual-minigame")
const manualSection = document.getElementById("manual-mode")
const rotationSection = document.getElementById("rotation-mode")
const minigamesSelects = document.querySelectorAll(".minigame-selects")
const codeTime = document.getElementById("code-time")
const saveConfigButton = document.getElementById("save-config")
const saveMessageText = document.getElementById("save-message")

let wasLoggedIn = null
let minigamesList = {}

exitConfigButton.addEventListener("click", async () => { 
  await loadStats()
  showScreen("panel")
})
configButton.addEventListener("click", async () => { 
  await loadConfig()
  changeMinigameMode(modeSelect.value)
  showScreen("config") 
})
logoutButton.addEventListener("click", async () => { await db.auth.signOut() })

formLogin.addEventListener("submit", async (e) => {
  e.preventDefault()
  
  loginButton.disabled = true
  try {
    const { data, error } = await db.auth.signInWithPassword({ email: emailInput.value, password: passwordInput.value })
    if (error) {
      if (error.code === "invalid_credentials") loginErrorText.textContent = "Email o contraseña incorrectos"
      else if (!error.code) loginErrorText.textContent = "Sin conexión"
      else loginErrorText.textContent = "No se pudo iniciar sesión, probá en unos minutos"
      return
    }
    else {
      emailInput.value = ""
      passwordInput.value = ""
    }
  } finally {
    loginButton.disabled = false
  }
})

db.auth.onAuthStateChange(async (_event, session) => {  
  let loggedIn = Boolean(session)

  if (wasLoggedIn !== loggedIn) {
    wasLoggedIn = loggedIn

    if (wasLoggedIn) {
      const {data, error} = await db.from("minijuegos").select("*")
      if (!error) minigamesList = data
      await loadStats()
      showScreen("panel")
    }
    else {
      minigamesList = {}
      showScreen("login")
    }
  }
})

formCode.addEventListener("submit", async (e) => {
  e.preventDefault()
  
  codeButton.disabled = true
  try {
    const code = cleanCode(codeInput.value)
    if (code.length === 6) showOutcome(await redeemCode(code))
    else {
      codeInput.setCustomValidity("Tiene que ser de 6 digitos")
      codeInput.reportValidity()
    }
  } finally {
    codeButton.disabled = false
    codeInput.value = ""
    await loadStats()
  }
})

codeInput.addEventListener("input", () => {
  codeOutcome.className = "base-code"
  codeOutcome.textContent = "Ingresá un código"

  codeInput.setCustomValidity("")
  codeInput.value = formatCode(cleanCode(codeInput.value))
})

function cleanCode(text) { return text.replace(/\D/g, "").slice(0, 6) }

function formatCode(code) { 
  if (code.length <= 3) { return code.slice(0, 3) }
  else { return code.slice(0, 3) + " - " + code.slice(3) }
}

async function redeemCode(code) {
  const { data, error } = await db.rpc("canjear_codigo", { p_codigo: code })
  
  if (error) { return {ok: false, error: "sin_conexion"} }
  else return data
}

function showOutcome(r) {
  codeOutcome.className = "base-code"
  if (r.ok) {
   codeOutcome.classList.add("good-code")
   codeOutcome.textContent = "✓ Válido" 
  }
  else {
    codeOutcome.classList.add("bad-code")
    if (r.error === "ya_usado") codeOutcome.textContent = errors[r.error] + "\n" + new Date(r.usado_en).toLocaleTimeString("es-AR", {hour: "2-digit", minute: "2-digit"})
    else codeOutcome.textContent = errors[r.error] ?? "✗ No se pudo verificar"
  }
}

async function hoyAr() {
  const { data, error } = await db.rpc("hoy_ar")
  return data
}

async function loadStats() {
  const { data, error } = await db.rpc("minijuego_de_hoy")
  if (error) return
  todayMinigame.textContent = minigamesList[data - 1].nombre

  const date = await hoyAr()
  const [playsRes, winsRes, reedemsRes] = await Promise.all([
    db.from("jugadas")
    .select("id", { count: "exact", head: true })
    .eq("fecha", date),

    db.from("jugadas")
    .select("id, codigos!inner(jugada_id)", { count: "exact", head: true })
    .eq("fecha", date),

    db.from("jugadas")
    .select("id, codigos!inner(jugada_id)", { count: "exact", head: true })
    .eq("fecha", date)
    .eq("codigos.usado", true)
  ])

  todayPlays.textContent = playsRes.count
  todayWins.textContent = winsRes.count
  todayRedeems.textContent = reedemsRes.count
}

formConfig.addEventListener("submit", async (e) => {
  e.preventDefault()
  saveConfigButton.disabled = true
  try { await saveConfig() }
  finally { saveConfigButton.disabled = false }
})

modeSelect.addEventListener("change", () => { changeMinigameMode(modeSelect.value) })

async function loadConfig() {
  const { data, error } = await db.from("config").select("modo, minijuego_manual, orden, horas_validez").single()

  if (error) { console.log("error al juntar los minijuegos"); return }

  modeSelect.value = data.modo

  minigamesSelects.forEach((s, i) => {
    s.length = 0
    for (const m of minigamesList) {
      const option = document.createElement("option")
      option.value = m.id
      option.textContent = m.nombre
      s.append(option)
    }
    minigamesSelects[i].value = data.orden[i]
  })

  manualSelect.length = 0
  for (const m of minigamesList) {
    const option = document.createElement("option")
    option.value = m.id
    option.textContent = m.nombre
    manualSelect.append(option)
  }
  manualSelect.value = data.minijuego_manual
  codeTime.value = data.horas_validez
}

async function saveConfig() {
  let order = []

  minigamesSelects.forEach((s, i) => { order[i] = Number(s.value) })

  const { data, error } = await db.from("config").update({
    modo: modeSelect.value,
    minijuego_manual: Number(manualSelect.value),
    orden: order,
    horas_validez: Number(codeTime.value)
  }).eq("id", 1).select()
  
  if (!data) saveMessageText.textContent = "Ocurrio un error al guardar"
  else saveMessageText.textContent = "Guardado con exito"
}

function changeMinigameMode(mode) {
  manualSection.hidden = true
  rotationSection.hidden = true

  switch (mode) {
    case "manual":
      manualSection.hidden = false
      break
  
    case "rotacion":
      rotationSection.hidden = false
      break;

    case "aleatorio":
      break
  }
}

function showScreen(screenName) {
  loginSection.hidden = true
  redeemSection.hidden = true
  todaySection.hidden = true
  configSection.hidden = true

  exitConfigButton.hidden = true
  configButton.hidden = true
  logoutButton.hidden = true

  switch (screenName) {
    case "login":
      loginSection.hidden = false
      break
  
    case "panel":
      redeemSection.hidden = false
      todaySection.hidden = false

      configButton.hidden = false
      logoutButton.hidden = false
      break

    case "config":
      configSection.hidden = false

      exitConfigButton.hidden = false
      logoutButton.hidden = false
      break
    
    default:
      console.warn("no existe esa pantalla")
      break
  }
}