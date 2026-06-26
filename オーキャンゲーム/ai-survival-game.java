package homework;
/*
 * メインクラス[ 宣言的なプログラミングに慣れよう！ ]
 */
public abstract class P05_List {
	abstract int getValue();		//値を返す
	abstract P05_List getCar();	//先頭要素を返す
	abstract P05_List getCdr();	//残りのリストを返す
	
	abstract int length();			//リストの長さを返す
	abstract int numElements(); 	//リストに含まれる 整数の数を返す
	
	abstract P05_List append(P05_List list); //自身の後ろにlistを連結した新たなリストを返す
	abstract P05_List flatten();	//リストに含まれる整数要素からなる，新たなリストを返す
	
	abstract P05_List reverse();    //リストを反転させる
	abstract P05_List reverseAll(); //要素こみでリストを反転させる
	

	abstract boolean contains(int val); //値valを持っているか？
	abstract int numElements(int val); //valをいくつ持っているか？
	abstract boolean eq(int val);		//valか？
	abstract P05_List delete(int val); //valをすべて捨てたリストを返す
	
	
	//Utility (エラーメッセージを表示し，強制終了)
	static void error(String msg){
		System.err.println(msg);
		System.exit(1);
	}
	
	//Utility 整数配列からリストを作る
	static P05_List genList(int[]value){
		P05_List list = P05_End.getInstance();
		for(int i = value.length-1; i >= 0; i--){
			list = new P05_Internal( new P05_Value(value[i]), list);
		}
		return list;
	}
	
	//Utility Listを表示する
	static String toString(P05_List list){
		if( list instanceof P05_Value){
			return list.getValue()+"";
		}
		if( P05_End.eq(list) ){
			return "";
		}
		StringBuffer sb = new StringBuffer();
		sb.append("[ ");
		for(P05_List cur = list; !P05_End.eq(cur); cur = cur.getCdr() ){
			sb.append(toString(cur.getCar())+", ");
		}
		sb.deleteCharAt(sb.length()-1);
		sb.deleteCharAt(sb.length()-1);
		sb.append(" ]");
		return sb.toString();	
	}
	
	public static void main(String[]args){
		P05_List list[] = new P05_List[6];
		list[0] = P05_List.genList( new int[]{1,2,3} );
		list[1] = P05_List.genList( new int[]{4,5,6} );
		list[2] = P05_List.genList( new int[]{7,8,9} );

		list[3] = new P05_Internal( list[0], list[1]);
		list[4] = new P05_Internal( list[2], list[3]);
		list[5] = new P05_Internal( list[3], list[2]);
		
		for(int i = 0; i < list.length; i++){
			System.out.println( P05_List.toString(list[i]) );
			System.out.println( list[i].length() );
			System.out.println( list[i].numElements());
			System.out.println( P05_List.toString( list[i].append(list[i]) ) );
			System.out.println( P05_List.toString( list[i].flatten() ) );
			System.out.println( P05_List.toString( list[i].reverse() ) );
			System.out.println( P05_List.toString( list[i].reverseAll() ) );
		}
	}
}

/*
 * 整数ノード
 */
class P05_Value extends P05_List {
	private int value;
	public P05_Value(int _value){
		value = _value;
	}
	
	@Override
	public int getValue() {
		return value;
	}
	@Override
	public P05_List getCar() {
		P05_List.error("Illegal");
		return null;
	}
	@Override
	public P05_List getCdr() {
		P05_List.error("Illegal");
		return null;
	}
	@Override
	public String toString(){
		return getValue()+"";
	}

	@Override
	public int length() {
		P05_List.error("Illegal");
		return 0;
	}
	@Override
	public int numElements() {
		return 1;
	}
	@Override
	public P05_List append(P05_List list) {
		P05_List.error("Illegal");
		return null;
	}
	@Override
	public P05_List flatten() {
		return new P05_Internal(this, P05_End.getInstance() );
	}
	@Override
	public P05_List reverse() {
		return this;
	}
	@Override
	public P05_List reverseAll() {
		return this;
	}
	
	@Override
	public boolean contains(int val){
		return getValue() == val;
	}
	@Override
	public int numElements(int val){
		return ( contains(val)? 1 : 0 );
	}

	@Override
	boolean eq(int val) {
		return contains(val);
	}

	@Override
	P05_List delete(int val) {
		P05_List.error("Illegal");
		return null;
	}
}
/*
 * リストの終端ノード
 */
class P05_End extends P05_List {
	static private P05_End obj = new P05_End();
	private P05_End(){ ;}
	static public P05_End getInstance(){
		return obj;
	}
	
	public static boolean eq(P05_List elm){
		return elm == obj;
	}

	@Override
	public int getValue() {
		P05_List.error("error");
		return (int)Double.NaN;
	}
	@Override
	public P05_List getCar() {
		P05_List.error("error");		
		return null;
	}
	@Override
	public P05_List getCdr() {
		P05_List.error("error");		
		return null;
	}
	@Override
	public String toString(){
		return "[]";
	}	
	@Override
	public int length() {
		return 0;
	}
	@Override
	public int numElements() {
		return 0;
	}
	@Override
	public P05_List append(P05_List list) {//自分の後ろにlistをつける
		return list;
	}
	@Override
	public P05_List flatten() {
		return this;
	}
	@Override
	public P05_List reverse() {
		return this;
	}
	@Override
	public P05_List reverseAll() {
		return this;
	}
	
	@Override
	public boolean contains(int val){
		return false;
	}
	@Override
	public int numElements(int val){
		return 0;
	}
	@Override
	boolean eq(int val) {
		return false;
	}
	@Override
	P05_List delete(int val) {
		return this;
	}
}

/*
 * リストの中間ノード(宿題の対象)
 */
class P05_Internal extends P05_List {
	private P05_List car;
	private P05_List cdr;
	
	public P05_Internal(P05_List _car, P05_List _cdr){
		if( P05_End.eq(_car) ){
			P05_List.error("null");			
		}
		car = _car;

		if( !(_cdr instanceof P05_Internal || _cdr instanceof P05_End) ){ 
			P05_List.error("null");
		}
		cdr = _cdr;
	}
	
	@Override
	public int getValue() {
		P05_List.error("Illegal");
		return (int)Double.NaN;
	}
	@Override
	public P05_List getCar() {
		return car;
	}
	@Override
	public P05_List getCdr() {
		return cdr;
	}
	@Override
	public String toString(){
		return "[" + getCar().toString() +"|" + getCdr() +"]";
	}

	//以降を作る
	@Override
	public int length() {
	    //作成しなさい
	}

	@Override
	public int numElements() {
	    //作成しなさい
	}
	@Override
	public P05_List append(P05_List list) {
	    //作成しなさい
	}
	@Override
	public P05_List flatten() {
	    //作成しなさい
	}

	@Override
	public P05_List reverse() {
	    //作成しなさい
	}	
	@Override
	public P05_List reverseAll() {
	    //作成しなさい
	}
	
	@Override
	public boolean contains(int val){
	    //作成しなさい
	}
	@Override
	public int numElements(int val){
	    //作成しなさい		
	}

	@Override
	boolean eq(int val) {
		return false;
	}

	@Override
	P05_List delete(int val) {
		P05_List car = getCar();
		if(car.eq(val)){
			return getCdr().delete(val);
		}
		return new P05_Internal( car, getCdr().delete(val));
	}
}

