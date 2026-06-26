Desafio DevOps


Foquei em construir um ambiente local simples e que subisse sem dores de cabeça usando o Docker Compose, além de estruturar os manifestos básicos do Kubernetes e a esteira do GitHub Actions para mostrar o fluxo de automação funcionando de ponta a ponta.

Como rodar o ambiente local

Para colocar o projeto de pé na máquina, basta clonar o repositório. As credenciais já estão configuradas diretamente no docker-compose.yml, então não é necessário criar um .env para o ambiente subir. O arquivo .env.example na raiz serve como referência das variáveis usadas caso você queira adaptar a configuração para outro ambiente. Depois disso, é só rodar o comando docker compose up --build no terminal para montar as imagens e subir os containers. Dá para testar se tudo subiu certo acessando http://localhost:3001 para confirmar que a API está respondendo, ou a rota http://localhost:3001/db-health para verificar especificamente a comunicação com o banco de dados.

Estrutura de conteinerização e Kubernetes

No Dockerfile, escolhi a imagem base node:20-alpine porque ela é bem mais leve e direta, o que ajuda a economizar espaço e tempo na hora de baixar as camadas. A receita define o diretório de trabalho em /usr/src/app, instala apenas as dependências de produção com --omit=dev para excluir pacotes como jest e nodemon da imagem final, copia o código da aplicação e expõe a porta 3000. A aplicação roda com o usuário node em vez de root, seguindo a boa prática de não executar processos com privilégios elevados em produção.

Na pasta /k8s, os arquivos configuram um Deployment básico com 2 réplicas para garantir que a aplicação não rode sozinha e tenha o mínimo de disponibilidade, junto com um Service do tipo ClusterIP para expor a porta interna do container de forma organizada dentro do cluster. As credenciais do banco de dados são injetadas no Deployment via um Secret do Kubernetes definido em k8s/secret.yaml, evitando que informações sensíveis fiquem expostas em texto plano nos manifestos.

Pipeline automatizado e banco de dados

O pipeline do GitHub Actions foi configurado no arquivo .github/workflows/ci-cd.yml e roda a cada push na branch main. O fluxo executa quatro etapas em sequência: faz o checkout do código, prepara o ambiente do Node e roda a suíte de testes unitários para garantir que nada foi quebrado, faz o build e publica a imagem no Docker Hub com duas tags — :latest e o hash do commit (github.sha) para rastreabilidade — e por fim executa o deploy no cluster Kubernetes atualizando a imagem do Deployment e aguardando o rollout completar com sucesso.
As credenciais do Docker Hub e o arquivo de configuração do cluster são armazenados como Secrets no repositório do GitHub (DOCKERHUB_USERNAME, DOCKERHUB_TOKEN e KUBE_CONFIG), nunca em texto plano no código. Isso garante que os logs do pipeline nunca exponham informações sensíveis.

Na parte de banco de dados, o ambiente local usa o MySQL oficial rodando via Docker Compose. Em produção, a configuração seria feita no AWS RDS com instância em subnet privada sem acesso público, backup automático habilitado com retenção de 7 dias, acesso restrito por Security Group apenas ao Security Group do EKS, e credenciais gerenciadas via Kubernetes Secret. Para verificar se o banco está operacional após um deploy, a rota /db-health da API executa um SELECT 1 e retorna o status da conexão.

Plano de ação para resolução de problemas

Se acontecer um cenário de erro 500 na API e o banco de dados travar com consumo de CPU em 100% após um deploy, meu primeiro passo seria olhar os logs dos containers para identificar o erro técnico e rodar um SHOW FULL PROCESSLIST no MySQL para descobrir qual consulta está travando a fila de processos. Se o problema tiver começado logo após a atualização, a prioridade é reverter a versão do deploy no ambiente para o estado anterior estável e derrubar as conexões presas que estão sufocando o servidor. Depois, com o ambiente normalizado, daria para analisar as consultas com o comando EXPLAIN para ver se falta algum índice nas tabelas ou estudar a necessidade de colocar um cache para aliviar o volume de requisições repetitivas.

Arquitetura recomendada na AWS

Pensando em como levar essa estrutura para rodar em produção na AWS de forma segura, a ideia seria usar um Application Load Balancer (ALB) na frente para receber as requisições da internet e distribuir o tráfego entre os nós de um cluster EKS. Para escalabilidade, o Deployment seria combinado com um HorizontalPodAutoscaler (HPA) que aumenta o número de réplicas automaticamente com base no consumo de CPU, sem intervenção manual. Para proteger as informações, tanto as instâncias do Kubernetes quanto o banco de dados RDS MySQL rodariam isolados dentro de subnets privadas, sem exposição direta para o mundo externo. O RDS configurado no modo Multi-AZ garante uma cópia replicada em tempo real em outra zona de disponibilidade, permitindo virada automática em caso de falha. Para monitoramento, os logs dos containers seriam coletados via Fluent Bit e enviados ao CloudWatch Logs, com o CloudWatch Container Insights fornecendo métricas de CPU, memória e rede por pod.