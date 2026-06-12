# Fenda do Biquini — FORA DO CARDUME
## Guia de Desenvolvimento — Demo

> *"Toda história de vilão é uma história de pertencimento que deu errado."*

---

## VISÃO GERAL

| Campo | Detalhe |
|---|---|
| **Título** | Fora do Cardume — Demo |
| **Gênero** | Plataforma 2D / Boss Rush |
| **Referência** | Cuphead |
| **Plataforma** | Web (Browser) |
| **Universo** | Bob Esponja — Fenda do Biquini |
| **Protagonista** | Plankton |
| **Versão** | Demo v1.0 |

---

## O QUE MUDA NA DEMO

Esta versão reduz a complexidade de implementação sem cortar conteúdo narrativo ou fases. As simplificações são:

- **Karen** existe como personagem narrativo — fala nos intervalos de texto, mas **não usa LLM**. Suas falas são fixas, escritas manualmente por fase.
- **Bosses não mudam de comportamento com base nas escolhas de diálogo.** Cada boss tem um único conjunto de ataques, sempre igual.
- **As escolhas de diálogo existem e são exibidas**, mas servem apenas à narrativa — não alteram o combate.
- **Habilidade Suprema escolhida no início**, antes da Fase 1: o jogador escolhe o Holandês Voador como aliado.
- **Após derrotar Bob Esponja (Fase 4)**, o jogador pode manter o pacto com o Holandês ou aceitar a aliança com Bob — essa escolha determina o final.
- **Sem cutscenes cinematográficas.** A história é contada por **textos narrativos** exibidos nos intervalos entre fases.

---

## ESTRUTURA DAS FASES

```
Prólogo → Escolha da Habilidade Suprema → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Escolha Final → Boss Final → Final
```

| Etapa | Evento | Tipo |
|---|---|---|
| Prólogo | Invasão ao Siri Cascudo | Combate (boss: Robô do Plankton) |
| Escolha Inicial | Pacto com o Holandês Voador | Tela de escolha narrativa |
| Fase 1 | Patrick Estrela | Combate |
| Fase 2 | Lula Molusco | Combate |
| Fase 3 | Sandy Bochechas | Combate |
| Fase 4 | Bob Esponja + Gary | Combate |
| Escolha Final | Manter Holandês ou aceitar Bob | Tela de escolha narrativa |
| Boss Final | Homem Sereia e Mexilhãozinho | Combate |

---

## A HISTÓRIA — TEXTOS NARRATIVOS

Os textos abaixo são exibidos como telas de intervalo entre as etapas. Sem animação elaborada — fundo simples, texto centralizado, botão para continuar.

---

### PRÓLOGO — "A Fórmula"

**[Tela de abertura — antes do combate]**

> *Plankton passou anos planejando este momento. Esta noite, finalmente, a fórmula secreta do Siri Cascudo seria sua.*
>
> *Karen estava integrada ao cockpit do robô. O plano era simples: entrar, pegar, sair.*
>
> *Não saiu simples.*

**[Após o combate do prólogo — o caos]**

> *O robô destruiu mais do que o planejado. Clientes corriam. Destroços caíam.*
>
> *Plankton viu o caos e não conseguiu ignorar: não era assim que devia ser.*
>
> Karen (comunicador): *"Plankton. A fórmula. Foco."*
>
> *Ele pegou a fórmula e fugiu.*
>
> *Então o Homem Sereia e o Mexilhãozinho chegaram. O redemoinho implodiu o robô. A fórmula se fragmentou em pedaços espalhados pela Fenda do Biquini.*
>
> *Plankton sobreviveu. Sozinho.*

---

### ESCOLHA DA HABILIDADE SUPREMA — "O Pacto"

**[Tela de escolha — logo após o prólogo]**

> *Das sombras oceânicas, o Navio Fantasma emergiu lentamente.*
>
> *O Holandês Voador olhou para o pequeno ser no chão e sorriu.*
>
> Holandês: *"Eu vi o que você fez lá dentro, Plankton. E vi o que eles fizeram com você logo depois. Parece injusto."*
>
> Holandês: *"Eu ofereço poder real. Âncoras amaldiçoadas. Barris de fogo. Com isso, você chega até a fórmula. Em troca — quando reunir todos os pedaços — você serve aos meus planos sobre os 7 mares."*
>
> Karen (comunicador): *"Plankton... isso é um contrato com o diabo."*
>
> Plankton: *"Eu sei."*

**[Botão único: "Aceitar o Pacto"]**

> *O pacto foi selado. O Holandês desapareceu nas profundezas. Plankton olhou para a Fenda do Biquini à sua frente.*
>
> Karen: *"Então vamos em frente. Fase a fase."*

---

### INTERVALO — Antes da Fase 1

**[Texto exibido antes do combate com Patrick]**

> *O primeiro fragmento da fórmula estava perto da pedra do Patrick. Claro.*
>
> Karen: *"Sinal forte embaixo da pedra dele. Ele provavelmente nem sabe que está lá."*
>
> Plankton: *"Patrick nunca sabe de nada."*
>
> *Mas ao se aproximar, Plankton pensou: Patrick era o único em toda a Fenda do Biquini que nunca o olhou com desdém. Só com confusão.*
>
> *Ainda assim — a fórmula vinha primeiro.*

---

### INTERVALO — Antes da Fase 2

**[Texto exibido antes do combate com Lula]**

> *O segundo fragmento estava no teatro do Lula. Naturalmente.*
>
> Karen: *"Ele provavelmente está no meio de um monólogo. Timing perfeito para entrar."*
>
> *Plankton parou na entrada do teatro. Lula passava os dias tocando para uma plateia vazia, sem reconhecimento, sem aplauso.*
>
> *Tinha algo familiar nisso.*
>
> Karen: *"Não comece a se identificar com ele agora."*
>
> Plankton: *"Não estou me identificando. Vamos entrar."*

---

### INTERVALO — Antes da Fase 3

**[Texto exibido antes do combate com Sandy]**

> *O terceiro fragmento estava na cúpula da Sandy. Ela com certeza já sabia.*
>
> Karen: *"Sensores indicam que ela detectou sua presença há 4 minutos."*
>
> Plankton: *"Ela sempre me tratou como igual intelectualmente. Diferente dos outros."*
>
> Karen: *"E mesmo assim você vai invadir o laboratório dela."*
>
> Plankton: *"A fórmula não se reúne sozinha, Karen."*
>
> *Uma pausa.*
>
> Karen: *"Não. Não se reúne."*

---

### INTERVALO — Antes da Fase 4

**[Texto exibido antes do combate com Bob Esponja]**

> *O último fragmento estava nas ruínas do Siri Cascudo. E Bob estava lá, guardando.*
>
> Karen: *"Ele sabe que você vai aparecer. Ficou esperando."*
>
> *Plankton olhou para as ruínas. Era culpa sua. O lugar onde Bob passava cada dia de sua vida estava destruído por causa dele.*
>
> Bob: *"Plankton. Você não precisa fazer isso."*
>
> Plankton: *"Eu sei que você acha que não."*
>
> Bob: *"Eu sei que você sofreu lá dentro. Eu também sofri."*
>
> *Plankton não respondeu. Avançou.*

---

### ESCOLHA FINAL — "Depois de Bob"

**[Tela de escolha — após derrotar Bob Esponja]**

> *Bob Esponja estava no chão das ruínas. Derrotado, mas olhando para Plankton sem raiva.*
>
> Bob: *"Você ganhou. Mas antes de ir... eu preciso te perguntar uma coisa."*
>
> Bob: *"O que você realmente quer, Plankton? A fórmula? O poder? Ou... você só queria ser parte de tudo isso aqui?"*
>
> *Plankton ficou em silêncio.*
>
> *O Holandês Voador apareceu no horizonte, aguardando.*
>
> Karen (comunicador, baixinho): *"...Plankton. Você sabe a resposta."*

**[Duas opções:]**

| Opção | Texto |
|---|---|
| **Manter o Pacto** | *"O acordo foi feito. Vamos terminar isso."* |
| **Aceitar a Aliança** | *"...Fica comigo nessa luta, Bob."* |

> *(A opção "Aceitar a Aliança" desbloqueia Bob Esponja como habilidade suprema para o Boss Final, substituindo o Holandês Voador.)*

---

### BOSS FINAL — Homem Sereia e Mexilhãozinho

**[Texto antes do combate final]**

> *Os heróis da Fenda do Biquini bloquearam o caminho.*
>
> Homem Sereia: *"Acaba aqui, Plankton."*
>
> *Plankton olhou para o comunicador de bolso onde Karen observava tudo.*
>
> Karen: *"Independente do que acontecer agora... foi uma jornada e tanto para uma criatura do seu tamanho."*
>
> *Plankton quase sorriu.*
>
> Plankton: *"Cala a boca, Karen."*

---

## HABILIDADES DO PLANKTON

| Habilidade | Descrição |
|---|---|
| **Raios Lasers** | Disparo em linha reta na direção do personagem. Dano moderado, cadência alta. |
| **Investida / Fuga** | Dash em linha reta na direção do personagem. Funciona no ar, sem delay de recarga. |

---

## HABILIDADE SUPREMA

A barra de habilidade carrega com **dano causado aos inimigos**. Ao ativar, o jogador escolhe entre dois ataques da aliança ativa.

### Holandês Voador *(Padrão — sempre disponível)*

| Habilidade | Descrição |
|---|---|
| **Âncoras Amaldiçoadas** | Quatro âncoras em padrão diagonal cobrindo 2/3 da tela. Dano massivo no impacto direto, reduzido nas bordas. |
| **Barris Amaldiçoados** | Salva de barris que explodem ao tocar o chão, deixando poças de fogo verde por tempo limitado. |

### Bob Esponja *(Disponível apenas se "Aceitar a Aliança" foi escolhido na Escolha Final)*

| Habilidade | Descrição |
|---|---|
| **Bolhas de Sabão** | Cinco bolhas que quicam pelo cenário aleatoriamente. Dano moderado por acerto. Destroem projéteis inimigos. |
| **Redes de Águas-Vivas** | Paralisia temporária e dano contínuo por 5 segundos. Dano considerável durante toda a duração. |

---

## BOSSES — ESPECIFICAÇÕES DE COMBATE

> Os bosses **não mudam de comportamento** com base nas escolhas de diálogo.
> As falas de escolha existem para a narrativa, mas o combate é sempre o mesmo padrão.

---

### BOSS 1 — Patrick Estrela

**Local:** Debaixo da Pedra — interior cavernoso, chão de areia, pedras suspensas como plataformas, luz filtrada de fresta no teto.

**Obstáculo de cenário:** Tufos de algodão saem dos cantos em intervalos irregulares. Ao tocar em Plankton, aplicam lentidão por 2 segundos. Frequência dobra na fase final.

**Escolha de diálogo (apenas narrativa):**
- *"Ei Patrick, isso aí não é seu. Me dá de volta."*
- *"Patrick, você quer brincar de pega-pega?"*

#### Ataques

| Ataque | Descrição |
|---|---|
| **Pedrada** | Patrick arremessa uma pedra horizontalmente. Rola pelo chão até a parede oposta. Cadência baixa, dano moderado. Pular para desviar. |
| **Barriga no Chão** | Queda de barriga gerando onda de impacto em semicírculo. Pular no momento exato. Patrick leva 2 segundos para se levantar — janela de punição. |

#### Fase Final — abaixo de 30% HP

- Três pedras simultâneas em ângulos diferentes
- Barriga no chão gera duas ondas em direções opostas
- Tufos de algodão dobram frequência
- Patrick grita: *"EU NÃO SEI O QUE ESTOU FAZENDO"*

---

### BOSS 2 — Lula Molusco

**Local:** Sala de teatro — palco central, cortinas vermelhas, instrumentos espalhados, holofote vindo do alto.

**Obstáculo de cenário:** Holofote se move em velocidade constante. Quando ilumina Plankton, Lula mira todos os ataques com precisão aumentada por 3 segundos. Na fase final, segundo holofote entra no cenário.

**Escolha de diálogo (apenas narrativa):**
- *"Você também sabe como é não pertencer a lugar nenhum, não sabe?"*
- *"Sua arte é medíocre e você sabe disso."*

#### Ataques

| Ataque | Descrição |
|---|---|
| **Notas Musicais** | Cinco notas em linha reta. Hitbox pequena, cadência alta. |
| **Estátua Explosiva** | Invoca estátua no centro do cenário. Explode após 3 segundos. Pode ser destruída com laser. |

#### Fase Final — abaixo de 35% HP

- Notas musicais passam a quicar nas paredes
- Duas estátuas invocadas simultaneamente
- Segundo holofote entra no cenário

---

### BOSS 3 — Sandy Bochechas

**Local:** Cúpula Submarina — equipamentos científicos, plantas texanas, plataformas de metal, painel de controle ao fundo.

**Obstáculo de cenário:** Painel de controle pisca em intervalos. Quando acende verde, Sandy ganha bônus de velocidade por 6 segundos. Destruir o painel com laser cancela o bônus, mas Sandy entra na fase final antecipadamente.

**Escolha de diálogo (apenas narrativa):**
- *"Você é a única aqui que de fato me entende intelectualmente."*
- *"Sua ciência não vale nada comparada à minha engenharia."*

#### Ataques

| Ataque | Descrição |
|---|---|
| **Lasers de Laboratório** | Quatro lasers horizontais em sequência, cada um em altura ligeiramente diferente. Carregamento visível de 1 segundo por laser. |
| **Robô de Teste** | Robô que persegue Plankton por 3 segundos. Empurra para fora da área segura sem dano direto. Destruído com dois acertos de laser. |

#### Fase Final — abaixo de 30% HP

- Quatro lasers disparados com robô ativo no cenário
- Granadas de gelo adicionadas — congelam Plankton por 1 segundo se atingido

---

### BOSS 4 — Bob Esponja + Gary

**Local:** Ruínas do Siri Cascudo — chão destruído com buracos, vigas caídas como plataformas, fogo residual nos cantos.

**Obstáculo de cenário:** Vigas do teto caem periodicamente em posições aleatórias. Causam dano se Plankton estiver embaixo. Criam novas plataformas temporárias onde pousam.

**Escolha de diálogo (apenas narrativa):**
- *"Eu não queria que ninguém se machucasse lá dentro."*
- *"Foi necessário. A fórmula era minha por direito."*

#### Ataques — Bob Esponja

| Ataque | Descrição |
|---|---|
| **Hambúrgueres** | Dois hambúrgueres em linha reta por sequência com a espátula. Cadência média, dano moderado. |
| **Absorção de Esponja** | Bob absorve o próximo laser e devolve como projétil. Janela de absorção de 2 segundos. Se Plankton não atirar, Bob apenas baixa a guarda. |

#### Segunda Fase — Gary entra abaixo de 50% HP do Bob

| Ataque | Descrição |
|---|---|
| **Rastro de Gosma** | Rastro no chão que torna o movimento de Plankton escorregadio enquanto em cima. Sem dano. |
| **Rolagem na Casca** | Gary rola em linha reta causando dano e empurrando Plankton. Gary não pode morrer. Aparece com baixa frequência. |

#### Fase Final — abaixo de 25% HP total

- Bob e Gary sincronizam ataques simultaneamente
- Vigas do teto aumentam frequência de queda

---

### BOSS FINAL — Homem Sereia e Mexilhãozinho

**Local:** Arena aberta na Fenda do Biquini — fundo oceânico, rocha e correntes marinhas naturais.

**Obstáculo de cenário:** Correntes marinhas mudam direção a cada 15 segundos — empurram Plankton levemente, podendo ajudar ou atrapalhar dependendo do posicionamento.

> O comportamento do boss **não muda** com base no caminho do jogador.
> O que muda é apenas a **habilidade suprema disponível** (Holandês ou Bob).

#### Ataques

| Ataque | Personagem | Descrição |
|---|---|---|
| **Raio Laser** | Homem Sereia | Raio rápido do cinto em linha reta. Velocidade alta, dano baixo. Pressão constante. |
| **Bolhas de Água** | Mexilhãozinho | Três bolhas lentas com trajetória levemente guiada. Velocidade baixa, dano considerável. |
| **Redemoinho em Dupla** | Ambos | Nadam em círculo criando redemoinho. Plankton dentro do raio é puxado para o centro e arremessado em parábola. Após o lançamento: 2 segundos de vulnerabilidade com dano crítico. |

#### Fase Final — abaixo de 40% HP

- M1 de ambos disparado simultaneamente
- Redemoinho com raio de atração aumentado
- Bolhas do Mexilhãozinho passam de 3 para 5 por sequência

---

## OS FINAIS

### FINAL A — Redenção

**Condição:** Escolha Final = "Aceitar a Aliança com Bob"

**[Texto do final]**

> *Plankton derrotou os heróis com Bob ao seu lado. A fórmula estava reunida.*
>
> *Foi então que Sandy apareceu com um relatório.*
>
> Sandy: *"Os clientes... não morreram. Eu ativei a barreira protetora instintivamente durante o caos. Os destroços pararam antes de atingir alguém."*
>
> *Um silêncio longo.*
>
> *Plankton olhou para a fórmula nas mãos. Olhou para Bob. Para Patrick que apareceu de trás de uma pedra sem entender muito bem o que estava acontecendo. Para Lula que fingiu não estar chorando. Para Sandy.*
>
> *Nenhum deles o chamou de herói. Nenhum fez um discurso.*
>
> *Bob apenas disse: "Então... tá. Você pode ficar por aqui."*
>
> *E era tudo que Plankton precisava ouvir.*

---

### FINAL B — O Desejo Traído

**Condição:** Escolha Final = "Manter o Pacto" + jogador usa o Holandês até o fim

**[Texto do final]**

> *Plankton venceu com o poder do Holandês. O pacto exigia que ele usasse a fórmula para servir ao mal nos 7 mares.*
>
> *O Holandês aguardava a entrega.*
>
> *Plankton ficou imóvel por um longo momento.*
>
> *Então usou seu desejo final — a única cláusula do contrato que ainda era sua — para que os clientes do Siri Cascudo que morreram no prólogo voltassem à vida.*
>
> *O Holandês, obrigado pelas forças do pacto a honrar qualquer desejo final, cumpriu. E foi embora furioso, sem poder fazer nada.*
>
> *Plankton ficou sozinho. Sem aliados. Sem o Holandês. Com a fórmula nas mãos e sem saber se alguém iria perdoá-lo.*
>
> *O jogo termina antes da resposta.*
>
> Karen (comunicador, muito baixinho): *"...você fez a coisa certa."*
>
> *Ele fez a coisa certa pelo motivo mais difícil.*

---

### FINAL C — O Fantoche

**Condição:** Escolha Final = "Manter o Pacto" + nenhuma tentativa de romper o acordo

**[Texto do final]**

> *Os clientes morreram de verdade no prólogo. O Holandês cobrou o trato. Plankton não teve saída.*
>
> *Com a fórmula reunida e o acordo cumprido, todos os personagens da Fenda do Biquini foram aprisionados no Navio Fantasma.*
>
> *Plankton e o Holandês governam os 7 mares.*
>
> *A última cena mostra Plankton num trono ao lado do Holandês Voador.*
>
> *Ele tem poder. Tem a fórmula. Tem tudo que sempre disse querer.*
>
> *E está cercado de absolutamente ninguém que ele de fato queria ter por perto.*
>
> Karen (comunicador, apagando): *"...Plankton—"*
>
> *Sinal perdido.*
>
> *Ele venceu. E acabou mais sozinho do que nunca.*

---

## PERSONAGENS

| Personagem | Papel na Demo |
|---|---|
| **Plankton** | Protagonista jogável |
| **Karen** | Narradora nos intervalos de texto — falas fixas por fase |
| **Seu Sirigueijo** | Mencionado na narrativa — sem combate |
| **Patrick Estrela** | Boss 1 |
| **Lula Molusco** | Boss 2 |
| **Sandy Bochechas** | Boss 3 |
| **Bob Esponja + Gary** | Boss 4 |
| **Holandês Voador** | Habilidade Suprema padrão |
| **Homem Sereia e Mexilhãozinho** | Boss Final |

---

*Fenda do Biquini — Fora do Cardume • Guia de Desenvolvimento Demo v1.0 • 2026*
