//author:Liew Yi
//Github: https://github.com/ly6161/eth_sender
//Web3.js code is thanks to Dr. Loke 
//Dr. Loke's github:
//https://github.com/ksloke/sendEther
//https://github.com/ksloke/sendEther/blob/master/web2sendEther.html

//hardcoded strings start
var token_addr='';
var decimals_mutable=18;
//hardcoded strings end

var max_count_for_backup_sent_addr=2;
var count_for_backup_sent_addr=max_count_for_backup_sent_addr;

var paused=false;
var backup_after_sending_to_certain_amount_of_addr=false;

var contract=null;
var from_addr_mutable=null;

var to_send_arr=[];
var sent_arrays=[];

var cur_to_addr=null;
var cur_token_type=null;
var cur_amount=null;
var cur_to_send_index=-1;

function web3_constructor(){
	//console.log('web3 constructor');
	//inject_web3();
}

function after_web3_loaded(){
	console.log('web3 loaded');
	init();
	document.getElementById('regenerate_contract_object_button').disabled=false;
}

//all initializations put in here
function init(){

//init decimals
decimals_mutable = web3.utils.toBN(decimals_mutable);

//300 milli-sec intervals, mutates from_addr_mutable variable
//start_interval_to_query_from_addr_in_metamask();
var accountInterval = setInterval(function() {
        web3.eth.getAccounts((error, address) => {
          if (address[0] !== from_addr_mutable) {
            from_addr_mutable = address[0];
            console.log('from_addr_mutable:'+from_addr_mutable);
          }
        });

      }, 300);

//contract object for sending calls
//contract=get_contract_object(token_addr);

//when from_addr_mutable is populated with valid address, button to start sending E3T is enabled
	
	setInterval(function(){
	if(web3.utils.isAddress(from_addr_mutable) && contract!==null){
		start_sending_button.disabled=false;
		}
	},2000);
	
}

var start_sending_button=null;
var sent_addr_text_area=null;
var to_send_text_area=null;
var download_link_element=null;
var token_addr_input=null;

window.addEventListener('load', async () => {
    if (window.ethereum) {
      window.web3 = new Web3(ethereum);
      try {
        await ethereum.enable();
        console.log(web3.version);
	after_web3_loaded();
      } catch (error) {
        console.log(error);
      }
    }
    else if (window.web3) {
	window.web3 = new Web3(web3.currentProvider);
	console.log(web3.version);
	after_web3_loaded();
    }
    else {
      console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
  }
});

window.addEventListener('load',function(){

	web3_constructor();
	
	/*document.getElementById('pause_button').addEventListener('click',function(){
		paused=true;
	});

	document.getElementById('resume_button').addEventListener('click',function(){
		resume();
	});*/


	//controllers here
	document.getElementById('regular_backups_checkbox').addEventListener('click',function(){
		backup_after_sending_to_certain_amount_of_addr=document.getElementById('regular_backups_checkbox').checked;
	});
	document.getElementById('regular_backups_checkbox').checked=true;

	document.getElementById('sent_file').addEventListener('change', load_sent_file,false);

	document.getElementById('to_send_file').addEventListener('change', load_to_send_file,false);

	document.getElementById('backup_every_num_sends_input').addEventListener('change', function(){
		var val=document.getElementById('backup_every_num_sends_input').value;
		val=parseInt(val);
		if(isNan(val)){
			val=100;
			document.getElementById('backup_every_num_sends_input').value=100;
		}else if(val<2){
			val=2;
			document.getElementById('backup_every_num_sends_input').value=2;
		}
		max_count_for_backup_sent_addr=val;
	});
	document.getElementById('backup_every_num_sends_input').value=max_count_for_backup_sent_addr;

	start_sending_button=document.getElementById('send_button');
	start_sending_button.disabled=true;
	start_sending_button.addEventListener('click',function(){
	send_next();
	alert('start sending');
	console.log('start sending')});

	sent_addr_text_area=document.getElementById('sent_addr_text_area');

	to_send_text_area=document.getElementById('to_send_text_area');

	download_link_element=document.getElementById('download_link_element');

	token_addr_input=document.getElementById('token_addr_input');

	document.getElementById('regenerate_contract_object_button').disabled=false;
	document.getElementById('regenerate_contract_object_button').addEventListener('click',function(){
		token_addr=token_addr_input.value;
		contract=get_contract_object(token_addr);
		console.log('Recreated contract interface using new token address.');
		alert('Recreated contract interface using new token address.');
		});
});

function load_sent_file(e){
	var files=e.target.files;
	file_reader=new FileReader();
	file_reader.addEventListener('load',function(){
		convert_csv_into_sent_arrays(file_reader.result);
	});
	file_reader.readAsText(files[0]);
}

//added side effect of appending text content to innerHTML of a text area
function convert_csv_into_sent_arrays(text_content){
	var temp_arr = $.csv.toArrays(text_content);
	if(temp_arr.length>1){
		//checking format
		if(temp_arr[1].length===4){
			sent_arrays=temp_arr;
			sent_addr_text_area.innerHTML= text_content;
			update_download_link_href();
		}	
	}else{
		console.log('must have at least 2 rows');	
	}
}

function reset_cur_to_send_index(){
	cur_to_send_index=-1;
}

//added side effect of resetting the index for selecting address to send in an array
function load_to_send_file(e){
	var files=e.target.files;
	file_reader=new FileReader();
	file_reader.addEventListener('load',function(){
		convert_csv_into_to_send_arr(file_reader.result);
	});
	file_reader.readAsText(files[0]);
	reset_cur_to_send_index();
}

//added side effect of appending text content to value of a text area
function convert_csv_into_to_send_arr(text_content){
	var temp_arr = $.csv.toArrays(text_content);
	if(temp_arr.length>1){
		//checking format
		if(temp_arr[1].length===3){
			to_send_arr=temp_arr;
			//to_send_text_area.value=text_content;
		}	
	}else{
		console.log('must have at least 2 rows');	
	}
}

//since the csv data is appended to text area html already, might as well use it's value instead of generating from array
function update_download_link_href(){
	download_link_element.href=createLink(sent_addr_text_area.value);
}

function update_download_link_element_filename(){
	var date_obj=new Date();
	date_str=date_obj.getDate().toString()+'-'+date_obj.getMonth()+'-'+date_obj.getFullYear().toString()+'_'+date_obj.getHours().toString()
	+'-'+date_obj.getMinutes().toString()+'-'+date_obj.getSeconds().toString();
	download_link_element.download='e3t_sent_backup_'+date_str+'.csv';
}

function update_and_download_from_download_link(){
	update_download_link_element_filename();
	update_download_link_href();
	download_link_element.click();
}

function createLink(txt){
	if(txt===null){
	return;
	}
	var file=null;
	var data=new Blob([txt],{type:'text/plain'});
	file=window.URL.createObjectURL(data);
	return file;
}

function inject_web3(){
 window.addEventListener('load', async () => {
    if (window.ethereum) {
      window.web3 = new Web3(ethereum);
      try {
        await ethereum.enable();
        console.log(web3.version);
	after_web3_loaded();
      } catch (error) {
        console.log(error);
      }
    }
    else if (window.web3) {
	window.web3 = new Web3(web3.currentProvider);
	console.log(web3.version);
	after_web3_loaded();
	web3_finished_loaded=true;
    }
    else {
      console.log('Non-Ethereum browser detected. You should consider trying MetaMask!');
  }
});
}

function start_interval_to_query_from_addr_in_metamask(){
  
}


function get_contract_object(token_addr){
	let abi = [
{"constant":false,"inputs":[{"name":"account","type":"address"}],"name":"addPauser","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"value","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"constant":false,"inputs":[{"name":"amount","type":"uint256"}],"name":"burn","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"subtractedValue","type":"uint256"}],"name":"decreaseAllowance","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"addedValue","type":"uint256"}],"name":"increaseAllowance","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"constant":false,"inputs":[],"name":"pause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"anonymous":false,"inputs":[{"indexed":false,"name":"account","type":"address"}],"name":"Paused","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"account","type":"address"}],"name":"PauserAdded","type":"event"},{"anonymous":false,"inputs":[{"indexed":true,"name":"account","type":"address"}],"name":"PauserRemoved","type":"event"},
	 {"constant":false,"inputs":[],"name":"renounceOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[],"name":"renouncePauser","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transfer","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"anonymous":false,"inputs":[{"indexed":true,"name":"from","type":"address"},{"indexed":true,"name":"to","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Transfer","type":"event"},
	 {"anonymous":false,"inputs":[{"indexed":true,"name":"owner","type":"address"},{"indexed":true,"name":"spender","type":"address"},{"indexed":false,"name":"value","type":"uint256"}],"name":"Approval","type":"event"},
	 {"anonymous":false,"inputs":[{"indexed":true,"name":"previousOwner","type":"address"},{"indexed":true,"name":"newOwner","type":"address"}],"name":"OwnershipTransferred","type":"event"},
	 {"constant":false,"inputs":[{"name":"from","type":"address"},{"name":"to","type":"address"},{"name":"value","type":"uint256"}],"name":"transferFrom","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"constant":false,"inputs":[{"name":"newOwner","type":"address"}],"name":"transferOwnership","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},{"inputs":[],"payable":false,"stateMutability":"nonpayable","type":"constructor"},
	 {"constant":false,"inputs":[],"name":"unpause","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"},
	 {"anonymous":false,"inputs":[{"indexed":false,"name":"account","type":"address"}],"name":"Unpaused","type":"event"},
	 {"constant":true,"inputs":[{"name":"owner","type":"address"},{"name":"spender","type":"address"}],"name":"allowance","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"decimals","outputs":[{"name":"","type":"uint8"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"isOwner","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[{"name":"account","type":"address"}],"name":"isPauser","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"name","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"owner","outputs":[{"name":"","type":"address"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"paused","outputs":[{"name":"","type":"bool"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"symbol","outputs":[{"name":"","type":"string"}],"payable":false,"stateMutability":"view","type":"function"},
	 {"constant":true,"inputs":[],"name":"totalSupply","outputs":[{"name":"","type":"uint256"}],"payable":false,"stateMutability":"view","type":"function"}
      ];
return new web3.eth.Contract(abi, token_addr);
}

function get_calculated_e3t_value(decimals_param, e3t_amount_param){
	//decimals_param=web3.utils.toBN(decimals_param);
	//e3t_amount_param=web3.utils.toBN(e3t_amount_param);
	//return e3t_amount_param.mul(web3.utils.toBN(10).pow(decimals_param));
	return convert_normal_number_to_wei(e3t_amount_param);
}

//hardcoded gas limit variable
function send_gas(from_addr_param,to_addr_param,gas_amount_in_wei_param){
	var gas_limit = 21000;
	var gas_price = web3.utils.toHex(web3.utils.toWei('1', 'gwei'));
	web3.eth.sendTransaction({
        from: from_addr_param,
        to: to_addr_param,
        gasLimit: gas_limit,
        gasPrice: gas_price,
        value: gas_amount_in_wei_param
        }).on('error',function(error,receipt){
		on_gas_transaction_error_event(error);
	}).on('transactionHash',function(tx){
		on_gas_transaction_event(to_addr_param,gas_amount_in_wei_param,tx);	
	}).on('confirmation',function(confirmation_number,receipt){
		console.log('Confirmation:'+confirmation_number)
	});
}

function send_e3t(from_addr_param, to_addr_param, decimals_param, e3t_amount_param) {
	var e3t_value=get_calculated_e3t_value(decimals_param,e3t_amount_param);
	if(!web3.utils.isAddress(to_addr_param)){
		on_e3t_transaction_error_event('Not an address! E3T not sent to this address:'+to_addr_param);
		return;	
	}
	contract.methods.transfer(to_addr_param, e3t_value).send({from: from_addr_param})
	.on('transactionHash', (tx) => {
	on_e3t_transaction_event(to_addr_param,e3t_amount_param,tx);
	}).on('error', (error, receipt) => {
	on_e3t_transaction_error_event(error);
	});
    }

function resume(){
	send_next();
}

//called by send_e3t method, a trick to capture it's events.
function on_e3t_transaction_event(to_addr_param, e3t_amount_param, tx_param){
	append_to_sent(to_addr_param,'e3t',e3t_amount_param,tx_param);
	send_next();
}

function on_e3t_transaction_error_event(error){
	console.log(error);
}

function on_gas_transaction_event(to_addr_param,gas_amount_in_wei_param,tx_param){
	append_to_sent(to_addr_param,'gas',convert_wei_to_normal_number(gas_amount_in_wei_param),tx_param);
	send_next();
}

function on_gas_transaction_error_event(error){
	console.log(error);
}

function append_to_sent(to_addr_param,token_type,amount,tx){
	if(!is_addr_and_token_sent(to_addr_param,token_type)){
	sent_addr_text_area.value+=to_addr_param+','+token_type+','+tx+','+amount+'\r\n';
	sent_arrays.push([to_addr_param,token_type,tx,amount]);
	}
}

function convert_wei_to_normal_number(wei){
	return wei/Math.pow(10,18);	
}

function convert_normal_number_to_wei(number){
	//e.g. 0.1=100000000000000000
	return number*Math.pow(10,18);
}
function custom_assert_if_false(condition,msg_if_false){
	if(!condition){
		console.log(msg_if_false);
	}
	return condition;
}



function send_next(){
	//if(paused){
	//	console.log('Paused sending');
	//return;	
	//}
	
	count_for_backup_sent_addr--;
	if(backup_after_sending_to_certain_amount_of_addr){
		if(count_for_backup_sent_addr<1){
			update_and_download_from_download_link();
			count_for_backup_sent_addr= max_count_for_backup_sent_addr;			
		}
	}
	
	
	if(cur_to_send_index<to_send_arr.length-1){
		cur_to_send_index++;

		if(cur_to_send_index===to_send_arr.length-1){
			console.log("Complete. final sending count: "+sent_arrays.length);
			update_and_download_from_download_link();
		}		
	
		to_send_arr[cur_to_send_index];
		var to_addr=to_send_arr[cur_to_send_index][0];
		var token_type=to_send_arr[cur_to_send_index][1];
		var amount=to_send_arr[cur_to_send_index][2];
		console.log('token type:'+token_type);
	
		if(token_type!=='e3t' && token_type!=='gas'){
			console.log('Incorrect token type:'+token_type+',addr:'+to_addr+',amount:'+amount);
		}
		if(token_type=='e3t'){
			//send_e3t(from_addr_mutable,to_addr,decimals_mutable,amount);
			
			if(!is_addr_and_token_sent(to_addr,token_type)){
			send_e3t(from_addr_mutable,to_addr,decimals_mutable,amount);
			}else{
			console.log('Already sent e3t to:'+to_addr);
			send_next();
			}
		}else if(token_type=='gas'){
			if(custom_assert_if_false(convert_normal_number_to_wei(0.1)===100000000000000000,'Convert number to wei incorrect')){
				//send_gas(from_addr_mutable,to_addr,convert_normal_number_to_wei(amount));				
								
				if(!is_addr_and_token_sent(to_addr,token_type)){			
				send_gas(from_addr_mutable,to_addr,convert_normal_number_to_wei(amount));
				}else{
				console.log('Already sent gas to:'+to_addr);
				send_next();
				}
			}
		}
	}
}

//disabled checking for duplicates due to requirement change, by changing the return value as always false
function is_addr_and_token_sent(addr,token_type){
	var is_sent=false;
	for(var i=0;i<sent_arrays.length;i++){
		var sent_addr=sent_arrays[i][0];
		var sent_token_type=sent_arrays[i][1];
		if(addr===sent_addr && sent_token_type===token_type){
			is_sent=true;
			break;	
			}
		}
	//return is_sent;
	return false;
}

//author:Liew Yi
//Github: https://github.com/ly6161/eth_sender
//web3.js code based on (Dr. Loke's github):
//https://github.com/ksloke/sendEther
//https://github.com/ksloke/sendEther/blob/master/web2sendEther.html
