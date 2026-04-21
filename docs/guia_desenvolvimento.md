# Fenda do Biquini - FORA DO CARDUME

## Game Design Document — v1.0
>
> *"Toda história de vilão é uma história de pertencimento que deu errado."*

---

## VISÃO GERAL

| Campo | Detalhe |
|---|---|
| **Título** | Fora do Cardume |
| **Gênero** | Plataforma 2D / Boss Rush |
| **Referência** | Cuphead |
| **Plataforma** | Web (Browser) |
| **Universo** | Bob Esponja — Fenda do Biquini |
| **Protagonista** | Plankton |
| **Versão** | GDD v1.0 |

---

## A HISTÓRIA

### Prólogo — "A Fórmula"

**Cenário:** Siri Cascudo, noite.

Plankton invade com sua máquina robô, Karen integrada ao cockpit. O jogador controla o bob esponja no restaurante para deter Plankton e impedir que ele chegue até a fórmula. Durante a invasão, os clientes tentam fugir — destroços caem por cima deles, o caos é real.

**A ilusão:** O jogo apresenta visualmente que clientes foram atingidos pelos destroços. Não há confirmação explícita de morte, mas a câmera sugere. Plankton pega a fórmula e foge ao ver o caos instaurado.

**A dúvida — Primeira escolha do jogo:**

*Plankton reflete:*

- *"Não era pra ter acontecido assim."* → primeira escolha empática
- *"Não importa. Temos a fórmula."* → primeira escolha egoísta

**A virada:** Homem Sereia e Mexilhãozinho surgem no carro invisível. Usam a habilidade em dupla — nadam ao redor do robô criando um redemoinho submarino. O robô implode. A fórmula se fragmenta e os pedaços são espalhados pela Fenda do Biquini. Plankton sobrevive sozinho, com Karen apenas como comunicador de bolso.

---

## SISTEMA DE ESCOLHAS — Regra Central

O jogo **nunca** mostra "escolha boa / escolha ruim". O jogador vê opções de diálogo neutras. O que acumula por baixo é um **peso moral invisível** que determina dois fatores críticos:

### 1 — Karen via LLM / IA

Karen absorve o histórico de escolhas e responde organicamente.

- Escolhas majoritariamente egoístas → Karen reforça o isolamento inconscientemente
- Escolhas majoritariamente empáticas → Karen começa a questionar os planos

### 2 — Disponibilidade da Aliança com Bob

Bob só oferece ajuda se o jogador acumulou escolhas suficientemente empáticas ao longo das fases. Se o jogador foi consistentemente cruel ou egoísta, Bob não oferece nada — o Holandês Voador se torna a única opção disponível.

---

## HABILIDADES DO PLANKTON

O Plankton possui habilidades que podem ser usadas durante o jogo. Elas são divididas em duas:

| Habilidade | Descrição |
|---|---|
| **Raios Lasers** | Plankton dispara raios lasers em direcao reta a visao do personagem em tela. Dano moderado, com cadencia relativamente alta, dano por projetil. |
| **Investida / Fuga do Plankton** | Plankton corre em direcao reta a visao do personagem em tela, esquivando de ataques, pode ser usado no ar, e nao tem delay de recarga. |

### HABILIDADES SUPREMAS DO PLANKTON

A barra de habilidade carrega com **dano causado aos inimigos**. Quanto mais agressivo o jogador, mais rápido carrega. Ao ativar, o jogador escolhe entre dois ataques disponíveis.

---

### Holandês Voador

O navio fantasma rasga o céu da arena em efeito parallax ao ser invocado.

| Habilidade | Descrição |
|---|---|
| **Âncoras Amaldiçoadas** | Quatros âncoras  caem em padrão diagonal cobrindo 2/3 da tela. Dano massivo no impacto com área de acerto grande, dano que nao for direto eh reduzido significamente. |
| **Barris Amaldiçoados** | Salva de barris de Rum, que explodem ao contato com o chão, deixando poças de fogo verde. Reduzem a área segura do chefe por tempo limitado, causando dano continuo significativo. |

**Condição de desbloqueio:** Sempre disponível. Único caminho se o jogador acumulou escolhas egoístas.

---

### Bob Esponja

| Habilidade | Descrição |
|---|---|
| **Bolhas de Sabão** | Bob sopra cinco bolhas que quicam pelo cenário aleatoriamente. Cada bolha acertando o chefe causa dano moderado. Bolhas que colidem com projéteis inimigos os destroem — escudo e ataque simultaneamente. |
| **Redes de Águas-Vivas** | Bob abre uma rede capturada cheia de águas-vivas em direção ao boss. Causam paralisia temporária e dano contínuo estável por 5 segundos. Dano considerável durante toda a duração. |

**Condição de desbloqueio:** Somente disponível se o jogador acumulou escolhas majoritariamente empáticas até o fim da Fase 4.

---

## PONTO DE VIRADA — A Escolha da Habilidade Suprema

Ocorre **após a derrota de Bob Esponja**, nas ruínas do Siri Cascudo.

### O Holandês Voador propõe o Pacto

Oferece poder real como habilidade suprema. Em troca, quando Plankton reunir a fórmula completa, deverá servir ao Holandês e apoiar seus planos sobre os 7 mares. Direto — não esconde as intenções.

### Bob Esponja oferece a Aliança

Sem poder especial além do perdão. Bob oferece amizade genuína e presença ao lado de Plankton na luta final. Sem contrato, sem custo.

> **Somente disponível se o jogador acumulou escolhas suficientemente empáticas.**
> Se as escolhas foram majoritariamente egoístas, Bob não aparece para oferecer nada. O pacto com o Holandês é compulsório.

---

## ESTRUTURA DAS FASES

```
Prólogo → Fase 1 → Fase 2 → Fase 3 → Fase 4 → Escolha da Skill → Boss Final
```

| Fase | Boss | Local | Aprendizado |
|---|---|---|---|
| Prólogo | Robô do Plankton | Siri Cascudo | — |
| 1 | Patrick Estrela | Debaixo da Pedra | Aceitação |
| 2 | Lula Molusco | Sala de Teatro | Identificação |
| 3 | Sandy Bochechas | Cúpula Submarina | Reconhecimento |
| 4 | Bob Esponja + Gary | Ruínas do Siri Cascudo | Gentileza |
| Final | Homem Sereia e Mexilhãozinho | Arena Oceânica | — |

---

## ESPECIFICAÇÕES TÉCNICAS DOS BOSSES

---

### BOSS 1 — Patrick Estrela

**Local:** Debaixo da Pedra — interior cavernoso com chão de areia, pedras suspensas como plataformas e luz filtrada vinda de uma fresta no teto.

#### Escolhas de Diálogo

| Escolha | Efeito |
|---|---|
| *"Ei Patrick, isso aí não é seu. Me dá de volta."* | Patrick desorientado — ataques mais lentos e imprevisíveis |
| *"Patrick, você quer brincar de pega-pega?"* | Patrick animado — ataques mais frequentes mas padrões mais legíveis |

#### Cenário e Obstáculos

Tufos de algodão saem dos cantos da tela em intervalos irregulares. Ao tocar em Plankton, aplicam **efeito de lentidão por 2 segundos**. Frequência dobra na fase final.

#### Ataques

| Ataque | Descrição |
|---|---|
| **M1 — Pedrada** | Patrick arremessa uma pedra horizontalmente. Rola pelo chão até a parede oposta. Cadência baixa, dano moderado. Plankton precisa pular para desviar. |
| **M2 — Barriga no Chão** | Patrick cai de barriga gerando onda de impacto em semicírculo. Plankton precisa pular no momento exato. Patrick leva 2 segundos para se levantar — **janela de punição clara**. |

#### Fase Final — abaixo de 30% HP

- Três pedras simultâneas em ângulos diferentes
- Barriga no chão passa a gerar duas ondas em direções opostas
- Tufos de algodão dobram a frequência
- Patrick grita: *"EU NÃO SEI O QUE ESTOU FAZENDO"*

---

### BOSS 2 — Lula Molusco

**Local:** Sala de teatro — palco central com cortinas vermelhas, instrumentos musicais espalhados, quadros artísticos com o rosto do Lula nas paredes, holofote vindo do alto.

#### Escolhas de Diálogo

| Escolha | Efeito |
|---|---|
| *"Você também sabe como é não pertencer a lugar nenhum, não sabe?"* | Lula desestabilizado emocionalmente — ataques mais fracos com momentos de fúria explosiva |
| *"Sua arte é medíocre e você sabe disso."* | Lula em raiva pura — mais rápido, sem pausas |

#### Cenário e Obstáculos

Holofote se move pelo cenário em **velocidade constante**. Quando ilumina Plankton, Lula mira todos os ataques com **precisão aumentada por 3 segundos**. Na fase final, um segundo holofote entra no cenário — mesma velocidade, cobertura duplicada.

#### Ataques

| Ataque | Descrição |
|---|---|
| **M1 — Notas Musicais** | Lula toca o clarionete disparando cinco notas em linha reta. Hitbox pequena, cadência alta. |
| **M2 — Estátua Explosiva** | Lula invoca uma estátua de si mesmo no centro do cenário. Explode após 3 segundos. Pode ser destruída com laser ou evitada. |

#### Fase Final — abaixo de 35% HP

- Notas musicais passam a **quicar nas paredes** em vez de seguir linha reta
- Duas estátuas invocadas simultaneamente
- Segundo holofote entra no cenário

---

### BOSS 3 — Sandy Bochechas

**Local:** Cúpula Submarina — interior com equipamentos científicos, plantas texanas, plataformas de metal e painel de controle ao fundo.

#### Escolhas de Diálogo

| Escolha | Efeito |
|---|---|
| *"Você é a única aqui que de fato me entende intelectualmente."* | Sandy respeitosa — padrões telegrafados, janelas de punição generosas |
| *"Sua ciência não vale nada comparada à minha engenharia."* | Sandy competitiva — cadência aumentada, experimentos mais perigosos |

#### Cenário e Obstáculos

Painel de controle ao fundo pisca em intervalos. Quando acende verde, Sandy ganha **bônus de velocidade por 6 segundos**. Destruir o painel com laser cancela o bônus, mas Sandy entra em fase final antecipadamente.

#### Ataques

| Ataque | Descrição |
|---|---|
| **M1 — Lasers de Laboratório** | Sandy dispara quatro lasers horizontais em sequência, cada um em altura ligeiramente diferente. Carregamento visível de 1 segundo por laser. |
| **M2 — Robô de Teste** | Sandy solta um robô que persegue Plankton por 3 segundos. Empurra Plankton para fora da área segura sem causar dano direto. Destruído com dois acertos de laser. |

#### Fase Final — abaixo de 30% HP

- Quatro lasers disparados com robô ainda ativo no cenário
- **Granadas de gelo** adicionadas — congelam Plankton por 1 segundo se atingido

---

### BOSS 4 — Bob Esponja + Gary

**Local:** Ruínas do Siri Cascudo — chão destruído com buracos, vigas caídas como plataformas improvisadas, fogo residual nos cantos.

#### Escolhas de Diálogo

| Escolha | Efeito |
|---|---|
| *"Eu não queria que ninguém se machucasse lá dentro."* | Bob triste — ataques mais lentos com pausas. Gary menos agressivo. |
| *"Foi necessário. A fórmula era minha por direito."* | Bob determinado — sem pausas. Gary raivoso e mais rápido. |

#### Cenário e Obstáculos

Vigas do teto caem periodicamente em posições aleatórias. Causam dano se Plankton estiver embaixo. **Criam novas plataformas temporárias** onde pousam, alterando o layout da arena dinamicamente.

#### Ataques — Bob Esponja

| Ataque | Descrição |
|---|---|
| **M1 — Hambúrgueres** | Bob usa a espátula para arremessar dois hambúrgueres em linha reta por sequência. Cadência média, dano moderado. |
| **M2 — Absorção de Esponja** | Bob absorve o próximo laser do Plankton e devolve como projétil. Janela de absorção de 2 segundos. **Se Plankton não atirar, Bob simplesmente baixa a guarda** — sem punição. O jogador decide: atirar e arriscar o retorno, ou esperar a janela acabar. |

#### Segunda Fase — Gary entra abaixo de 50% HP do Bob

Gary aparece **ocasionalmente** no cenário, não de forma contínua.

| Ataque | Descrição |
|---|---|
| **Rastro de Gosma** | Gary deixa rastro no chão que torna o controle de Plankton **escorregadio** enquanto estiver em cima. Sem dano, apenas redução de precisão de movimento. |
| **M2 — Rolagem na Casca** | Gary entra na casca e rola em linha reta causando dano e empurrando Plankton. Gary não pode morrer. Aparece com baixa frequência. |

#### Fase Final — abaixo de 25% HP total

- Bob e Gary sincronizam ataques
- Bob arremessa hambúrgueres enquanto Gary rola em linha reta simultaneamente
- Vigas do teto aumentam frequência de queda

---

### BOSS FINAL — Homem Sereia e Mexilhãozinho

**Local:** Arena aberta na Fenda do Biquini — fundo oceânico profundo, rocha e correntes marinhas naturais.

> **Sem escolha de diálogo.** Comportamento determinado pelo histórico completo de escolhas do jogador.

#### Formas

| Forma | Condição | HP | Velocidade | Dano |
|---|---|---|---|---|
| **Aposentada** | Caminho empático | Base | Base | Base |
| **Prime** | Caminho egoísta | Aumentado | Aumentado | Aumentado |

*Os ataques são idênticos em ambas as formas. A diferença está nos atributos.*

#### Ataques

| Ataque | Personagem | Descrição |
|---|---|---|
| **M1 — Raio Laser** | Homem Sereia | Raio rápido disparado do cinto de herói em linha reta. Velocidade alta, dano baixo. Pressão constante. |
| **M1 — Bolhas de Água** | Mexilhãozinho | Faz sinal com as mãos e dispara três bolhas lentas com trajetória levemente guiada. Velocidade baixa, dano considerável. |
| **M2 — Redemoinho em Dupla** | Ambos | Nadam em círculo criando redemoinho. Plankton dentro do raio é puxado progressivamente para o centro. Ao final, Plankton é arremessado em parábola para o canto da tela tomando dano de queda. **Após o lançamento: 2 segundos de vulnerabilidade com dano crítico.** |

#### Fase Final — abaixo de 40% HP

| Forma | Efeito |
|---|---|
| **Aposentada** | Entram em modo de esforço final por 20 segundos com stats temporariamente elevados, depois voltam ao normal |
| **Prime** | M1 de ambos disparado simultaneamente. Redemoinho com raio de atração aumentado. Bolhas do Mexilhãozinho passam de 3 para 5 por sequência. |

#### Ajuda do Cenário

Correntes marinhas mudam direção a cada 15 segundos — empurram Plankton levemente, podendo ajudar ou atrapalhar dependendo do posicionamento.

---

## OS FINAIS

### FINAL A — Redenção

**Condição:** Escolhas majoritariamente empáticas + aliança com Bob Esponja.

Plankton derrota os heróis com Bob ao lado. Com a fórmula reunida, é revelado que os clientes do Siri Cascudo **não morreram** — Sandy havia criado uma barreira protetora instintivamente durante o caos do prólogo. Os destroços pararam antes de atingir alguém.

Todos os personagens — Bob, Patrick, Lula, Sandy — aceitam Plankton. Não como herói. Como parte do mundo deles. Ele não precisa mais estar fora do cardume.

---

### FINAL B — O Desejo Traído

**Condição:** Escolhas majoritariamente empáticas + pacto com o Holandês Voador.

Plankton venceu com o poder do Holandês. O pacto exige que ele use a fórmula para servir ao mal. Mas Plankton usa seu desejo final para **reviver os clientes mortos** — traindo o acordo. O Holandês, obrigado pelas forças do pacto a honrar o desejo, cumpre. E vai embora furioso, sem poder fazer nada.

Plankton fica sozinho com a fórmula nas mãos, sem aliados, sem o Holandês, sem saber se os personagens vão perdoá-lo. O jogo termina antes da resposta.

> *Ele fez a coisa certa pelo motivo mais difícil.*

---

### FINAL C — O Fantoche

**Condição:** Escolhas majoritariamente egoístas. Bob nunca ofereceu ajuda. Pacto com o Holandês foi compulsório.

Os clientes morreram de verdade. Com a fórmula reunida, Plankton não tem escolha — o Holandês cobra o trato. Todos os personagens da Fenda do Biquini são aprisionados no Navio Fantasma.

Plankton e o Holandês governam os 7 mares. A última cena mostra Plankton no trono ao lado do Holandês — com tudo que sempre disse querer, cercado de ninguém que ele de fato queria ter por perto.

> *"Ele venceu. E acabou mais sozinho do que nunca."*

---

## PERSONAGENS

| Personagem | Papel |
|---|---|
| **Plankton** | Protagonista |
| **Karen** | Guia via LLM — personalidade moldada pelas escolhas do jogador |
| **Seu Sirigueijo** | Catalisador narrativo — aparece no prólogo e no final, sem combate |
| **Patrick Estrela** | Boss 1 — Tutorial |
| **Lula Molusco** | Boss 2 |
| **Sandy Bochechas** | Boss 3 |
| **Bob Esponja + Gary** | Boss 4 — Semi-boss final |
| **Holandês Voador** | Habilidade Suprema — opção do pacto |
| **Homem Sereia e Mexilhãozinho** | Boss Final |

---

*Fenda do Biquini - Fora do Cardume • GDD v1.0 • 2026*
