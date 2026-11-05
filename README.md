# Elyndor RPG — Ficha e Grimório

Site da ficha de personagem com grimório de poderes, protegido por senha.

**Jogadores**
1. Abram o link de convite que o mestre mandou.
2. Cliquem em **+ Nova ficha** e escolham uma senha. A ficha fica criptografada no navegador.
3. A ficha tem as abas Frente, Evolução, **Grimório** e Personagem. No Grimório ficam os cards de poder, com os botões Usar, Ligar/Desligar e Descanso longo.
4. Na aba **Enviar ao mestre**, gerem o código e mandem só para o mestre. Mandem de novo sempre que quiserem atualizar.
5. Para levar a ficha a outro aparelho, usem **Baixar backup** e depois **Importar backup**, com a mesma senha.

**Mestre**
1. Em **Mesa do mestre**, crie uma senha. Isso gera a chave da mesa.
2. Mande o link de convite aos jogadores.
3. Receba os códigos deles. Os cards mostram PV, VB, Fé, Evasiva e condições; **Ver ficha** mostra tudo, inclusive o grimório, sem edição.
4. Faça **Backup da mesa** de vez em quando.

**Segurança.** A ficha salva usa AES-256 com a senha do jogador, e o código enviado ao mestre usa ECDH P-256. Ninguém lê a ficha de outra pessoa, e nada vai para servidor nenhum. Não existe recuperação de senha: se alguém esquecer, o mestre pode **Exportar** a última versão que recebeu.

Fontes: EB Garamond e Lora (Google Fonts, SIL OFL).
