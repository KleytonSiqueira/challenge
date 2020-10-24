
const fs = require("fs");

const PNF = require('google-libphonenumber').PhoneNumberFormat;

const phoneUtil = require('google-libphonenumber').PhoneNumberUtil.getInstance();   

//Lendo o arquivo de forma assincrona
let lendo_stream = fs.createReadStream("input.csv",{encoding:'ascii'});

let conteudo = [];
let cabecalho = [];
let formatJson = {};
let adresses = [];
let adressJson = {};
let saida = [];
let groups = [];

//Tratando os eventos
lendo_stream.on("data",(data)=>{

    //Armazenando cada uma das linhas como itens do array "conteudo"
    conteudo = conteudo.concat(data.split("\n").map(item=>{
        return item.replace(/\r/g,"").replace(/\"/g,"");
    }));

});
//Verificando se houve falha
lendo_stream.on("error",(err)=>{

    console.error("Erro: ",err);

});

//Quando termina de ler o arquivo
lendo_stream.on("close",()=>{

    //Atribuimos a primeira linha como um array que identifica o "cabeçalho" e já removemos caracteres desnecessários
    cabecalho = conteudo[0].split(",").map((item)=>{

        if(item.indexOf(" ")>-1)
            return item.split(" ").map(el=>{
                return el.trim();
            });
        return item.trim();
    
    });
    //Tratamos cada linha de forma individual a partir da segunda
    conteudo.splice(1,).forEach((item)=>{
        //A cada item reiniciamos os objetos e arrays que irão representar os dados daquela linha
        adresses = [];
        formatJson = {};
        groups = [];
        //Guardamos em um array todos os dados separados por vírgula
        let array = item.split(",");
        //Aqui verifica se a quantidade de dados excede a quantidade de campos
        // Essa situação se dá quando no grupo é recebido dados com o formato "sala 1, sala 2, ..., sala n"
        if(array.length>cabecalho.length){

            //os campos a mais são retirados e guardados em um array
            let temp = array.splice(cabecalho.indexOf("group"),array.length-cabecalho.length);
            //O array gerado é transformado em uma string separada por "/"
            array[cabecalho.indexOf("group")] = temp.concat(array[cabecalho.indexOf("group")]).join("/");

        }
        //Tratando cada um dos campos
        array.forEach((field,indexfield)=>{
            //inicializando o json correspondente ao item em 'adresses'
            adressJson = {};
            //Verificando se o campo não é um objeto, pois os atributos que irão fazer parte do atributo 'adresses' foram transformados em array, onde o primeiro item identifica o type e os outros as tags
            if(typeof cabecalho[indexfield] != "object")

                if(cabecalho[indexfield]=="group"){

                    //Só é gravada a informação se o dado não estiver vazio
                    if(field!="")
                        //tratando os grupos separados por "/" com if ternário
                        groups = groups.concat(
                            (field.indexOf("/")>-1)?
                                field.split("/").map(el=>{
                                    return el.trim()
                                })
                            : field.trim()
                        );

                }else{
                    //Switch para tratar os campos com valor booleano
                    switch(cabecalho[indexfield]){
                        case "invisible":
                        case "see_all":
                            formatJson[cabecalho[indexfield]] = ["yes","1"].indexOf(field)>-1;
                            break;
                        default:
                            formatJson[cabecalho[indexfield]] = field;
                    }

                }
            //Se for objeto
            else{
                //Somente grava se houver informação
                if(field!=""){

                    switch(cabecalho[indexfield][0]){
                        case "email":
                            //Verificando se o email não é válido
                            let teste = /^[0-9a-z_\-\.]+\@[a-z.]+(com|com.br)$/i;
                            if(!(teste.test(field)))
                                //Verificando se tem ocorrencia de "@"
                                if(field.indexOf("@")>-1){
                                    //Verificando se o erro não foi separar mais de um email por "/" ou espaço no mesmo campo
                                    var temp = field.split((field.indexOf("/")>-1)?"/":" ");
                                    for(var i = temp.length-1; i>=0 ; i--)
                                        if(teste.test(temp[i])){
                                            //caso encontrou, grava o ultimo email listado
                                            field = temp[i];
                                            break;
                                        }
                                        
                                    //Se no fim não tiver encontrado nenhum email valido, não grava os dados
                                    if(field==temp.join("/"))
                                        break;
                                }else
                                    break;

                            if(field.indexOf(" ")>-1)
                                field = field.substring(0,field.indexOf(" "));
                            adressJson["type"] = cabecalho[indexfield][0];
                            adressJson["tags"] = (cabecalho[indexfield]).slice(1);
                            adressJson["adress"] = field;
                            //Adicionando o novo item ao adresses
                            adresses = adresses.concat(adressJson);
                            break;
                        case "phone":
                            //Verificando se a informção é válida para um número de telefone
                            if(!(/^[0-9(\ \)\-]+$/.test(field)))
                                break;
                            let numero = phoneUtil.parseAndKeepRawInput(field, 'BR');
                            //Verificando se o Número é válido
                            if(!phoneUtil.isValidNumber(numero))
                                break;
                            field = numero.getCountryCode().toString()+numero.getNationalNumber().toString();
                        default:
                            adressJson["type"] = cabecalho[indexfield][0];
                            adressJson["tags"] = (cabecalho[indexfield]).slice(1);
                            adressJson["adress"] = field;
                            adresses = adresses.concat(adressJson);
                    }
                }
            }

        });
        formatJson["adresses"] = adresses;
        formatJson["groups"] = groups;
        //variável de controle que indica se já houve uma ocorrencia de usuário
        let temGravado = false;
        if(saida.length>0)
            saida.filter((obj,indexObj)=>{

                if(obj["eid"] != formatJson["eid"])
                    return false;
                //ao encontrar uma ocorrência
                else{
                    //indica que já foi gravado
                    temGravado = !temGravado;
                    //Adiciona todos os itens que veio por meio do 'adresses'
                    saida[indexObj]["adresses"] = saida[indexObj]["adresses"].concat(formatJson["adresses"]);
                    //Verifica cada item do grupo para analisar se algum item está se repetindo, caso não, é adicionado
                    formatJson["groups"].forEach(el=>{
                        if(saida[indexObj]["groups"].indexOf(el)==-1)
                            saida[indexObj]["groups"] = saida[indexObj]["groups"].concat(el);
                    });
                    //Se houver alguma informação que não consta nos dados que já foram gravados, ela é atualizada
                    Object.keys(obj).forEach(key=>{

                        if(!saida[indexObj][key] && formatJson[key])
                            saida[indexObj][key] = formatJson[key];

                    });
                    
                }

            });
        //Caso não tenha nenhuma ocorrência é adicionado ao array o novo objeto
        if(!temGravado)
                saida = saida.concat(formatJson);


    });
    //Após formatar todos os dados escreve em formato json dentro do arquivo
    fs.writeFile("output.json", JSON.stringify(saida), (erro)=> {
        //tratando erro
        if(erro) {
            throw erro;
        }

    }); 

});

