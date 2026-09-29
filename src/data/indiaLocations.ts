export interface IndianState {
  name: string;
  type: 'State' | 'Union Territory';
  cities: string[];
}

export const INDIAN_STATES_AND_UTS: IndianState[] = [
  // 28 States
  {
    name: 'Andhra Pradesh',
    type: 'State',
    cities: [
      'Visakhapatnam', 'Vijayawada', 'Guntur', 'Nellore', 'Kurnool', 
      'Rajahmundry', 'Tirupati', 'Kakinada', 'Kadapa', 'Anantapur', 
      'Eluru', 'Vizianagaram', 'Ongole', 'Nandyal', 'Machilipatnam'
    ]
  },
  {
    name: 'Arunachal Pradesh',
    type: 'State',
    cities: [
      'Itanagar', 'Naharlagun', 'Pasighat', 'Tawang', 'Ziro', 
      'Bomdila', 'Tezu', 'Aalo', 'Roing'
    ]
  },
  {
    name: 'Assam',
    type: 'State',
    cities: [
      'Guwahati', 'Silchar', 'Dibrugarh', 'Jorhat', 'Nagaon', 
      'Tinsukia', 'Tezpur', 'Bongaigaon', 'Karimganj', 'Sivasagar'
    ]
  },
  {
    name: 'Bihar',
    type: 'State',
    cities: [
      'Patna', 'Gaya', 'Bhagalpur', 'Muzaffarpur', 'Purnia', 
      'Darbhanga', 'Bihar Sharif', 'Arrah', 'Begusarai', 'Katihar', 
      'Munger', 'Chhapra', 'Sasaram', 'Dehri', 'Bettiah'
    ]
  },
  {
    name: 'Chhattisgarh',
    type: 'State',
    cities: [
      'Raipur', 'Bhilai', 'Bilaspur', 'Korba', 'Rajnandgaon', 
      'Jagdalpur', 'Raigarh', 'Ambikapur', 'Dhamtari', 'Mahasamund'
    ]
  },
  {
    name: 'Goa',
    type: 'State',
    cities: [
      'Panaji', 'Margao', 'Vasco da Gama', 'Mapusa', 'Ponda', 
      'Bicholim', 'Curchorem', 'Cuncolim'
    ]
  },
  {
    name: 'Gujarat',
    type: 'State',
    cities: [
      'Ahmedabad', 'Surat', 'Vadodara', 'Rajkot', 'Bhavnagar', 
      'Jamnagar', 'Gandhinagar', 'Junagadh', 'Gandhidham', 'Anand', 
      'Navsari', 'Morbi', 'Nadiad', 'Surendranagar', 'Bharuch', 'Vapi', 'Mehsana'
    ]
  },
  {
    name: 'Haryana',
    type: 'State',
    cities: [
      'Gurugram', 'Faridabad', 'Panipat', 'Ambala', 'Yamunanagar', 
      'Rohtak', 'Hisar', 'Karnal', 'Sonipat', 'Panchkula', 
      'Bhiwani', 'Sirsa', 'Bahadurgarh', 'Jind', 'Thanesar', 'Rewari'
    ]
  },
  {
    name: 'Himachal Pradesh',
    type: 'State',
    cities: [
      'Shimla', 'Dharamshala', 'Solan', 'Mandi', 'Palampur', 
      'Baddi', 'Nahan', 'Kullu', 'Manali', 'Una', 'Hamirpur', 'Bilaspur'
    ]
  },
  {
    name: 'Jharkhand',
    type: 'State',
    cities: [
      'Ranchi', 'Jamshedpur', 'Dhanbad', 'Bokaro Steel City', 'Deoghar', 
      'Phusro', 'Hazaribagh', 'Giridih', 'Ramgarh', 'Medininagar', 'Chirkunda'
    ]
  },
  {
    name: 'Karnataka',
    type: 'State',
    cities: [
      'Bengaluru', 'Mysuru', 'Hubballi-Dharwad', 'Mangaluru', 'Belagavi', 
      'Kalaburagi', 'Davanagere', 'Ballari', 'Vijayapura', 'Shivamogga', 
      'Tumakuru', 'Raichur', 'Bidar', 'Hosapete', 'Udupi', 'Hassan'
    ]
  },
  {
    name: 'Kerala',
    type: 'State',
    cities: [
      'Thiruvananthapuram', 'Kochi', 'Kozhikode', 'Kollam', 'Thrissur', 
      'Alappuzha', 'Palakkad', 'Malappuram', 'Kannur', 'Kottayam', 
      'Kasaragod', 'Pathanamthitta', 'Idukki', 'Wayanad'
    ]
  },
  {
    name: 'Madhya Pradesh',
    type: 'State',
    cities: [
      'Indore', 'Bhopal', 'Jabalpur', 'Gwalior', 'Ujjain', 
      'Sagar', 'Dewas', 'Satna', 'Ratlam', 'Rewa', 
      'Katni', 'Singrauli', 'Burhanpur', 'Khandwa', 'Morena', 'Bhind'
    ]
  },
  {
    name: 'Maharashtra',
    type: 'State',
    cities: [
      'Mumbai', 'Pune', 'Nagpur', 'Thane', 'Pimpri-Chinchwad', 
      'Nashik', 'Kalyan-Dombivli', 'Vasai-Virar', 'Chhatrapati Sambhajinagar (Aurangabad)', 
      'Navi Mumbai', 'Solapur', 'Mira-Bhayandar', 'Bhiwandi', 'Amravati', 
      'Nanded', 'Kolhapur', 'Akola', 'Panvel', 'Ulhasnagar', 'Sangli', 'Malegaon', 'Jalgaon', 'Latur', 'Dhule'
    ]
  },
  {
    name: 'Manipur',
    type: 'State',
    cities: [
      'Imphal', 'Thoubal', 'Bishnupur', 'Churachandpur', 'Kakching', 'Ukhrul'
    ]
  },
  {
    name: 'Meghalaya',
    type: 'State',
    cities: [
      'Shillong', 'Tura', 'Jowai', 'Nongpoh', 'Williamnagar', 'Baghmara'
    ]
  },
  {
    name: 'Mizoram',
    type: 'State',
    cities: [
      'Aizaww', 'Lunglei', 'Champhai', 'Serchhip', 'Kolasib', 'Lawngtlai'
    ]
  },
  {
    name: 'Nagaland',
    type: 'State',
    cities: [
      'Kohima', 'Dimapur', 'Mokokchung', 'Tuensang', 'Wokha', 'Zunheboto', 'Mon'
    ]
  },
  {
    name: 'Odisha',
    type: 'State',
    cities: [
      'Bhubaneswar', 'Cuttack', 'Rourkela', 'Berhampur', 'Sambalpur', 
      'Puri', 'Balasore', 'Bhadrak', 'Baripada', 'Jharsuguda', 'Jeypore'
    ]
  },
  {
    name: 'Punjab',
    type: 'State',
    cities: [
      'Ludhiana', 'Amritsar', 'Jalandhar', 'Patiala', 'Bathinda', 
      'Hoshiarpur', 'Mohali (SAS Nagar)', 'Batala', 'Pathankot', 'Moga', 
      'Abohar', 'Malerkotla', 'Khanna', 'Phagwara', 'Muktsar'
    ]
  },
  {
    name: 'Rajasthan',
    type: 'State',
    cities: [
      'Jaipur', 'Jodhpur', 'Kota', 'Bikaner', 'Ajmer', 
      'Udaipur', 'Bhilwara', 'Alwar', 'Bharatpur', 'Sikar', 
      'Pali', 'Sri Ganganagar', 'Kishangarh', 'Barmer', 'Hanumangarh', 'Beawar'
    ]
  },
  {
    name: 'Sikkim',
    type: 'State',
    cities: [
      'Gangtok', 'Namchi', 'Geyzing', 'Mangan', 'Rangpo', 'Jorethang'
    ]
  },
  {
    name: 'Tamil Nadu',
    type: 'State',
    cities: [
      'Chennai', 'Coimbatore', 'Madurai', 'Tiruchirappalli', 'Salem', 
      'Tiruppur', 'Erode', 'Vellore', 'Thoothukudi', 'Dindigul', 
      'Thanjavur', 'Ranipet', 'Sivakasi', 'Karur', 'Udhagamandalam (Ooty)', 'Hosur', 'Nagercoil', 'Kanchipuram'
    ]
  },
  {
    name: 'Telangana',
    type: 'State',
    cities: [
      'Hyderabad', 'Warangal', 'Nizamabad', 'Karimnagar', 'Ramagundam', 
      'Khammam', 'Mahbubnagar', 'Nalgonda', 'Adilabad', 'Siddipet', 'Miryalaguda'
    ]
  },
  {
    name: 'Tripura',
    type: 'State',
    cities: [
      'Agartala', 'Dharmanagar', 'Udaipur', 'Kailashahar', 'Belonia', 'Khowai'
    ]
  },
  {
    name: 'Uttar Pradesh',
    type: 'State',
    cities: [
      'Noida', 'Greater Noida', 'Ghaziabad', 'Lucknow', 'Kanpur', 
      'Agra', 'Varanasi', 'Prayagraj (Allahabad)', 'Meerut', 'Bareilly', 
      'Aligarh', 'Moradabad', 'Saharanpur', 'Gorakhpur', 'Ayodhya (Faizabad)', 
      'Firozabad', 'Jhansi', 'Muzaffarnagar', 'Mathura', 'Budaun', 'Rampur', 
      'Shahjahanpur', 'Farrukhabad', 'Hapur', 'Etawah', 'Mirzapur', 'Bulandshahr'
    ]
  },
  {
    name: 'Uttarakhand',
    type: 'State',
    cities: [
      'Dehradun', 'Haridwar', 'Roorkee', 'Haldwani', 'Rudrapur', 
      'Kashipur', 'Rishikesh', 'Nainital', 'Mussoorie', 'Pithoragarh', 'Kotdwar'
    ]
  },
  {
    name: 'West Bengal',
    type: 'State',
    cities: [
      'Kolkata', 'Howrah', 'Asansol', 'Siliguri', 'Durgapur', 
      'Bardhaman', 'Malda', 'Baharampur', 'Habra', 'Kharagpur', 
      'Shantipur', 'Dankuni', 'Dhulian', 'Ranaghat', 'Haldia', 'Darjeeling'
    ]
  },

  // 8 Union Territories
  {
    name: 'Andaman and Nicobar Islands',
    type: 'Union Territory',
    cities: ['Port Blair', 'Diglipur', 'Mayabunder', 'Rangat']
  },
  {
    name: 'Chandigarh',
    type: 'Union Territory',
    cities: ['Chandigarh', 'Sector 17', 'Sector 35', 'Manimajra', 'Industrial Area']
  },
  {
    name: 'Dadra and Nagar Haveli and Daman and Diu',
    type: 'Union Territory',
    cities: ['Daman', 'Diu', 'Silvassa', 'Amli', 'Naroli']
  },
  {
    name: 'Delhi',
    type: 'Union Territory',
    cities: [
      'Delhi', 'New Delhi', 'Central Delhi', 'North Delhi', 'South Delhi', 
      'East Delhi', 'West Delhi', 'Connaught Place', 'Dwarka', 'Rohini', 
      'Saket', 'Karol Bagh', 'Lajpat Nagar', 'Vasant Kunj', 'Janakpuri', 'Pitampura'
    ]
  },
  {
    name: 'Jammu and Kashmir',
    type: 'Union Territory',
    cities: ['Srinagar', 'Jammu', 'Anantnag', 'Baramulla', 'Udhampur', 'Kathua', 'Sopore', 'Rajouri']
  },
  {
    name: 'Ladakh',
    type: 'Union Territory',
    cities: ['Leh', 'Kargil', 'Nubra', 'Drass', 'Zanskar']
  },
  {
    name: 'Lakshadweep',
    type: 'Union Territory',
    cities: ['Kavaratti', 'Agatti', 'Andrott', 'Minicoy', 'Amini']
  },
  {
    name: 'Puducherry',
    type: 'Union Territory',
    cities: ['Puducherry', 'Karaikal', 'Mahe', 'Yanam', 'Oulgaret']
  }
];

export const ALL_INDIAN_STATES = INDIAN_STATES_AND_UTS.filter(s => s.type === 'State').map(s => s.name);
export const ALL_INDIAN_UTS = INDIAN_STATES_AND_UTS.filter(s => s.type === 'Union Territory').map(s => s.name);
export const ALL_INDIAN_REGIONS = INDIAN_STATES_AND_UTS.map(s => s.name);

export function getCitiesForState(stateName: string): string[] {
  const match = INDIAN_STATES_AND_UTS.find(
    s => s.name.toLowerCase() === stateName.toLowerCase().trim()
  );
  return match ? match.cities : [];
}

export function isValidIndianState(stateName: string): boolean {
  if (!stateName) return false;
  return INDIAN_STATES_AND_UTS.some(
    s => s.name.toLowerCase() === stateName.toLowerCase().trim()
  );
}
