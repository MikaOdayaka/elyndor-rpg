# Elyndor RPG: ficha, grimório e mesa ao vivo

Site aberto: **https://mikaodayaka.github.io/elyndor-rpg/**

Qualquer pessoa pode criar um personagem, sem convite e sem conta.

## Jogadores
1. Abram o site e cliquem em **+ Criar personagem**. A senha tranca a ficha no navegador; ela não pode ser recuperada.
2. A ficha calcula as coisas sozinha:
   - os totais, contando bônus de armadura e de itens;
   - as penalidades das condições (com nível) e das Marcas do Limiar;
   - o desgaste da armadura;
   - os descansos (5%, 15%, 40% e 100%).
3. Para rolar, cliquem no nome de uma perícia ou de um atributo, ou no 🎲 de um ataque. Usar um poder toca um som e mostra um efeito; cada um pode subir o próprio som.
4. Para jogar, cliquem em **🎲 Entrar na mesa** e digitem o código que o mestre passar, ou abram o link que ele mandar.

## Mestre
1. Cliquem em **Mestre** e depois em **Abrir mesa ao vivo**. O código da mesa é sempre o mesmo.
2. Use **Convidar** para copiar o link e mande no grupo.
3. A mesa tem:
   - mapa (imagem), grade, tokens, régua, ping, lápis, névoa e iniciativa;
   - chat com rolagens (`/r 2d6+3`, ou `/rs` para rolagem secreta);
   - as fichas dos jogadores atualizando ao vivo.
4. Quando alguém usa um poder, aparece um balão em cima do token e uma mensagem no chat.
5. Deixe a mesa aberta enquanto jogam. A cena fica salva no navegador do mestre.

## Como funciona
- Os navegadores se conectam direto (WebRTC criptografado). O servidor gratuito do PeerJS só apresenta um navegador ao outro.
- Alguns jogadores podem não conseguir conectar, em certas redes de celular ou de empresa. Nesse caso, o jogador pode mandar a ficha por código, em **Mestre → Fichas por código**.

## Arquivos
`index.html`, `core.js`, `ficha.js`, `mesa.js` e este `README.md`. Para atualizar o site, suba os arquivos novos por cima.
