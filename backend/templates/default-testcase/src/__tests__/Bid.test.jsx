import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

import App from '../App';

const bidsListResponse = [
  {
    id: 1,
    bidNumber: '#122345678123',
    createdBy: 'Sunder Yadav',
    startDate: '2024-02-14',
    startTime: '17:40',
    timeRemaining: '7h 20m',
    fromCity: 'Gurgaon',
    toCity: 'Mumbai',
    vehicleType: 'Truck 20 ft',
    bodyType: 'Close body',
    noOfVehicles: 1,
    materialWeight: 4000,
    response: 4,
    assignedStaff: 'Mohit',
    staffId: '52t520lt61264',
    status: 'live',
  },
  {
    id: 2,
    bidNumber: '#122345678124',
    createdBy: 'Rajesh Kumar',
    startDate: '2024-02-14',
    startTime: '18:30',
    timeRemaining: '8h 10m',
    fromCity: 'Delhi',
    toCity: 'Bangalore',
    vehicleType: 'Truck 32 ft',
    bodyType: 'Open body',
    noOfVehicles: 2,
    materialWeight: 6000,
    response: 7,
    assignedStaff: 'Amit',
    staffId: '52t520lt61265',
    status: 'live',
  },
  {
    id: 3,
    bidNumber: '#122345678125',
    createdBy: 'Priya Sharma',
    startDate: '2024-02-13',
    startTime: '16:20',
    timeRemaining: '2h 40m',
    fromCity: 'Pune',
    toCity: 'Hyderabad',
    vehicleType: 'Truck 20 ft',
    bodyType: 'Close body',
    noOfVehicles: 1,
    materialWeight: 3500,
    response: 5,
    assignedStaff: 'Rahul',
    staffId: '52t520lt61266',
    status: 'responded',
  },
  {
    id: 4,
    bidNumber: '#122345678126',
    createdBy: 'Amit Verma',
    startDate: '2024-02-13',
    startTime: '15:15',
    timeRemaining: '1h 30m',
    fromCity: 'Chennai',
    toCity: 'Kolkata',
    vehicleType: 'Truck 24 ft',
    bodyType: 'Container',
    noOfVehicles: 1,
    materialWeight: 5000,
    response: 2,
    assignedStaff: 'Suresh',
    staffId: '52t520lt61267',
    status: 'unresponded',
  },
];

const bidsApiUrl = 'https://edtech-exam-api.vercel.app/api/bids';

// Setup MSW server with dynamic handlers
const server = setupServer(
  http.get(bidsApiUrl, ({ request }) => {
    const url = new URL(request.url);
    const createdBy = url.searchParams.get('createdBy');
    const sortBy = url.searchParams.get('sortBy');
    const id = url.searchParams.get('id');

    // Handle single bid request by ID
    if (id) {
      const bid = bidsListResponse.find(b => b.id === parseInt(id));
      if (bid) {
        return HttpResponse.json({ success: true, data: bid });
      }
      return HttpResponse.json({ success: false, message: 'Bid not found' }, { status: 404 });
    }

    let result = [...bidsListResponse];

    // Filter by createdBy
    if (createdBy) {
      result = result.filter(b =>
        b.createdBy.toLowerCase().includes(createdBy.toLowerCase())
      );
      
      if (result.length === 0) {
        return HttpResponse.json({ success: false, message: 'No bids found for the given name' }, { status: 404 });
      }
    }

    // Sort by date
    if (sortBy === 'asc') {
      result.sort((a, b) => new Date(a.startDate) - new Date(b.startDate));
    } else if (sortBy === 'desc') {
      result.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
    }

    return HttpResponse.json({ success: true, count: result.length, data: result });
  })
);

// Helper to render App
const renderApp = (initialRoute = '/') => {
  window.history.pushState({}, 'Test page', initialRoute);
  return render(<App />);
};

const originalConsoleError = console.error;

describe('Bid Management Application Tests', () => {
  beforeAll(() => {
    server.listen();
  });

  afterEach(() => {
    server.resetHandlers();
    console.error = originalConsoleError;
  });

  afterAll(() => {
    server.close();
  });

  // ============================================
  // OLD TESTS - ROUTING TESTS
  // ============================================

  describe('Sidebar Navigation Tests', () => {
    it(':::RJSCED18BN_test_1:::Page should consist of a Link from react-router-dom in the sidebar with "Bid" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /Bid/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_2:::Page should consist of a Link from react-router-dom in the sidebar with "POD" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /POD/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_3:::Page should consist of a Link from react-router-dom in the sidebar with "Vendor" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /Vendor/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_4:::Page should consist of a Link from react-router-dom in the sidebar with "User" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /User/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_5:::Page should consist of a Link from react-router-dom in the sidebar with "Settings" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /Settings/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_6:::Page should consist of a Link from react-router-dom in the sidebar with "Profile" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /Profile/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_7:::Page should consist of a Link from react-router-dom in the sidebar with "Contact Us" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /Contact Us/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_8:::Page should consist of a Link from react-router-dom in the sidebar with "Logout" as text content:::5:::', () => {
      renderApp();
      expect(screen.getByRole('link', { name: /Logout/i })).toBeInTheDocument();
    });
  });

  describe('Route Navigation Tests', () => {
    it(':::RJSCED18BN_test_9:::When the "/pod" is provided in the browser tab then the page should be navigated to PODPage and consists of an HTML heading element with "POD Module" as text content:::5:::', () => {
      renderApp('/pod');
      expect(screen.getByRole('heading', { name: /POD Module/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_10:::When the "/vendor" is provided in the browser tab then the page should be navigated to VendorPage and consists of an HTML heading element with "Vendor Module" as text content:::5:::', () => {
      renderApp('/vendor');
      expect(screen.getByRole('heading', { name: /Vendor Module/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_11:::When the "/user" is provided in the browser tab then the page should be navigated to UserPage and consists of an HTML heading element with "User Module" as text content:::5:::', () => {
      renderApp('/user');
      expect(screen.getByRole('heading', { name: /User Module/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_12:::When the "/settings" is provided in the browser tab then the page should be navigated to Settings page and consists of an HTML heading element with "Settings" as text content:::5:::', () => {
      renderApp('/settings');
      expect(screen.getByRole('heading', { name: /Settings/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_13:::When the "/profile" is provided in the browser tab then the page should be navigated to Profile page and consists of an HTML heading element with "Profile" as text content:::5:::', () => {
      renderApp('/profile');
      expect(screen.getByRole('heading', { name: /Profile/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_14:::When the "/contact" is provided in the browser tab then the page should be navigated to Contact page and consists of an HTML heading element with "Contact Us" as text content:::5:::', () => {
      renderApp('/contact');
      expect(screen.getByRole('heading', { name: /Contact Us/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_15:::When the "/logout" is provided in the browser tab then the page should be navigated to Logout page and consists of an HTML heading element with "Logout" as text content:::5:::', () => {
      renderApp('/logout');
      expect(screen.getByRole('heading', { name: /Logout/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_16:::When a "/bad-path" is provided in the URL, then the page should be navigated to Not Found Route and consist of an HTML image element with alt attribute value as "not-found":::5:::', () => {
      renderApp('/bad-path-xyz');
      expect(screen.getByRole('img', { name: /not-found/i })).toBeInTheDocument();
    });
  });

  describe('Click Navigation Tests', () => {
    it(':::RJSCED18BN_test_17:::When the POD link in the sidebar is clicked then the page should be navigated to PODPage with "/pod" in URL path:::5:::', async () => {
      renderApp('/');
      const user = userEvent.setup();
      await user.click(screen.getByRole('link', { name: /POD/i }));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /POD Module/i })).toBeInTheDocument();
      });
      expect(window.location.pathname).toBe('/pod');
    });

    it(':::RJSCED18BN_test_18:::When the Vendor link in the sidebar is clicked then the page should be navigated to VendorPage with "/vendor" in URL path:::5:::', async () => {
      renderApp('/');
      const user = userEvent.setup();
      await user.click(screen.getByRole('link', { name: /Vendor/i }));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Vendor Module/i })).toBeInTheDocument();
      });
      expect(window.location.pathname).toBe('/vendor');
    });

    it(':::RJSCED18BN_test_19:::When the User link in the sidebar is clicked then the page should be navigated to UserPage with "/user" in URL path:::5:::', async () => {
      renderApp('/');
      const user = userEvent.setup();
      await user.click(screen.getByRole('link', { name: /User/i }));
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /User Module/i })).toBeInTheDocument();
      });
      expect(window.location.pathname).toBe('/user');
    });

    it(':::RJSCED18BN_test_20:::When the Bid link in the sidebar is clicked then the page should be navigated to BidListPage with "/" in URL path:::5:::', async () => {
      renderApp('/pod');
      const user = userEvent.setup();
      await user.click(screen.getByRole('link', { name: /Bid/i }));
      await waitFor(() => {
        expect(screen.getByText('Bid Created')).toBeInTheDocument();
      });
      expect(window.location.pathname).toBe('/');
    });
  });

  // ============================================
  // OLD TESTS - API FETCHING TESTS
  // ============================================

  describe('Bid List API Tests', () => {
    it(':::RJSCED18BN_test_21:::When the Bid List Page is opened, an HTTP GET request should be made to the given bidsApiUrl to get the list of bids:::5:::', async () => {
      const originalFetch = window.fetch;
      const mockFetchFunction = vi.fn().mockImplementation(() =>
        Promise.resolve({
          json: () => Promise.resolve({
            success: true,
            count: bidsListResponse.length,
            data: bidsListResponse
          }),
        })
      );
      window.fetch = mockFetchFunction;

      renderApp();

      await waitFor(() => {
        expect(mockFetchFunction).toHaveBeenCalledWith(
          expect.stringContaining(bidsApiUrl)
        );
      }, { timeout: 10000 });

      window.fetch = originalFetch;
    });

    it(':::RJSCED18BN_test_22:::Page should consist of at least two HTML list items and the bids list received in the response should be rendered using a unique key as a prop for each bid item:::5:::', async () => {
      console.error = (message) => {
        if (
          /Each child in a list should have a unique "key" prop/.test(message) ||
          /Encountered two children with the same key/.test(message)
        ) {
          throw new Error(message);
        }
      };

      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('7h 20m')).toBeInTheDocument();
      expect(screen.getByText('8h 10m')).toBeInTheDocument();
      expect(screen.getByText('2h 40m')).toBeInTheDocument();
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });
  });

  describe('Bid List Data Display Tests', () => {
    it(':::RJSCED18BN_test_23:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "bidNumber" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        const bid1Elements = screen.queryAllByText((content, element) => {
          return element?.textContent?.includes('#122345678123') || false;
        });
        expect(bid1Elements.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });
      
      const bid2Elements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('#122345678124') || false;
      });
      expect(bid2Elements.length).toBeGreaterThanOrEqual(1);
      
      const bid3Elements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('#122345678125') || false;
      });
      expect(bid3Elements.length).toBeGreaterThanOrEqual(1);
      
      const bid4Elements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('#122345678126') || false;
      });
      expect(bid4Elements.length).toBeGreaterThanOrEqual(1);
    });

    it(':::RJSCED18BN_test_24:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "createdBy" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        const sunderElements = screen.queryAllByText((content, element) => {
          return element?.textContent?.includes('Sunder Yadav') || false;
        });
        expect(sunderElements.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });
      
      const rajeshElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Rajesh Kumar') || false;
      });
      expect(rajeshElements.length).toBeGreaterThanOrEqual(1);
      
      const priyaElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Priya Sharma') || false;
      });
      expect(priyaElements.length).toBeGreaterThanOrEqual(1);
    });

    it(':::RJSCED18BN_test_25:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "timeRemaining" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText('7h 20m')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('8h 10m')).toBeInTheDocument();
      expect(screen.getByText('2h 40m')).toBeInTheDocument();
      expect(screen.getByText('1h 30m')).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_26:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "fromCity" and "toCity" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        const gurgaonElements = screen.queryAllByText((content, element) => {
          return element?.textContent?.includes('Gurgaon') || false;
        });
        expect(gurgaonElements.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });
      
      const mumbaiElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Mumbai') || false;
      });
      expect(mumbaiElements.length).toBeGreaterThanOrEqual(1);
      
      const delhiElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Delhi') || false;
      });
      expect(delhiElements.length).toBeGreaterThanOrEqual(1);
      
      const bangaloreElements = screen.getAllByText((content, element) => {
        return element?.textContent?.includes('Bangalore') || false;
      });
      expect(bangaloreElements.length).toBeGreaterThanOrEqual(1);
    });

    it(':::RJSCED18BN_test_27:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "vehicleType" and "bodyType" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        const truck20Elements = screen.queryAllByText('Truck 20 ft');
        expect(truck20Elements.length).toBeGreaterThanOrEqual(1);
      }, { timeout: 10000 });
      
      const closeBodyElements = screen.getAllByText('Close body');
      expect(closeBodyElements.length).toBeGreaterThanOrEqual(1);
      
      expect(screen.getByText('Truck 32 ft')).toBeInTheDocument();
      expect(screen.getByText('Open body')).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_28:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "materialWeight" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('6000')).toBeInTheDocument();
      expect(screen.getByText('3500')).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_29:::When the HTTP GET request made in Bid List Page is successful, then the page should consist of HTML elements with text content equal to the "assignedStaff" and "staffId" in bids received in the response:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText('Mohit')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('52t520lt61264')).toBeInTheDocument();
      
      const amitElements = screen.getAllByText('Amit');
      expect(amitElements.length).toBeGreaterThanOrEqual(1);
      
      expect(screen.getByText('52t520lt61265')).toBeInTheDocument();
    });
  });

  describe('Bid List Page UI Tests', () => {
    it(':::RJSCED18BN_test_30:::Bid List Page should consist of filter buttons with "Today", "Yesterday", and "Calendar" as text content:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('Yesterday')).toBeInTheDocument();
      expect(screen.getByText('Calendar')).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_31:::Bid List Page should consist of table header with "S.No", "Bid Number", "Start Date", "Bid Time Remaining", "From city", "Vehicle Type", "Material Weight", "Response" as text content:::5:::', async () => {
      renderApp();
      
      await waitFor(() => {
        expect(screen.getByText(/S.No/i)).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText(/Bid Number/i)).toBeInTheDocument();
      expect(screen.getByText(/Start Date/i)).toBeInTheDocument();
      expect(screen.getByText(/Bid Time/i)).toBeInTheDocument();
      expect(screen.getByText(/From city/i)).toBeInTheDocument();
      expect(screen.getByText(/Vehicle Type/i)).toBeInTheDocument();
      expect(screen.getByText(/Material Weight/i)).toBeInTheDocument();
      expect(screen.getByText(/Assigned Staff/i)).toBeInTheDocument();
    });
  });

  describe('Sidebar Logo Tests', () => {
    it(':::RJSCED18BN_test_32:::Sidebar should consist of an HTML element with text content as "LOGISTIC":::5:::', () => {
      renderApp();
      expect(screen.getByText('LOGISTIC')).toBeInTheDocument();
    });
  });

  describe('Page Count Tests', () => {
    it(':::RJSCED18BN_test_33:::Page should consist of at least eight links from react-router-dom in the sidebar:::5:::', () => {
      renderApp();
      const links = screen.getAllByRole('link');
      expect(links.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ============================================
  // NEW TESTS - BID DETAIL PAGE NAVIGATION
  // ============================================

  describe('Bid Detail Page Navigation Tests', () => {
    it(':::RJSCED18BN_test_34:::When a bid row is clicked, the page should navigate to the bid detail page with the correct id in the URL:::5:::', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sunderBid = screen.getByText('#122345678123');
      await user.click(sunderBid);

      await waitFor(() => {
        expect(window.location.pathname).toBe('/bid/1');
      });
    });

    it(':::RJSCED18BN_test_35:::When navigated to "/bid/1", the Bid Detail Page should make an HTTP GET request with id=1 query parameter:::5:::', async () => {
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ success: true, data: bidsListResponse[0] }),
        })
      );
      global.fetch = mockFetch;

      renderApp('/bid/1');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('id=1')
        );
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_36:::When navigated to Bid Detail Page, it should display all the bid details from the API response:::5:::', async () => {
      renderApp('/bid/1');

      await waitFor(() => {
        expect(screen.getByText('#122345678123')).toBeInTheDocument();
      }, { timeout: 10000 });

      expect(screen.getByText('Sunder Yadav')).toBeInTheDocument();
      expect(screen.getByText('2024-02-14')).toBeInTheDocument();
      expect(screen.getByText('17:40')).toBeInTheDocument();
      expect(screen.getByText('Gurgaon')).toBeInTheDocument();
      expect(screen.getByText('Mumbai')).toBeInTheDocument();
      expect(screen.getByText('Truck 20 ft')).toBeInTheDocument();
      expect(screen.getByText('4000 kg')).toBeInTheDocument();
    });

  });

  // ============================================
  // NEW TESTS - SEARCH FUNCTIONALITY
  // ============================================

  describe('Search Functionality Tests', () => {
    it(':::RJSCED18BN_test_37:::Bid List Page should have a search input field with placeholder "Search by name...":::5:::', async () => {
      renderApp();

      await waitFor(() => {
        const searchInput = screen.getByPlaceholderText(/Search by name.../i);
        expect(searchInput).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_38:::Bid List Page should have a Search button:::5:::', async () => {
      renderApp();

      await waitFor(() => {
        const searchButton = screen.getByRole('button', { name: /Search/i });
        expect(searchButton).toBeInTheDocument();
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_39:::When user types in search input and clicks Search button, an HTTP GET request should be made with createdBy query parameter:::5:::', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ 
            success: true, 
            count: 1, 
            data: [bidsListResponse[0]] 
          }),
        })
      );
      global.fetch = mockFetch;

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const searchInput = screen.getByPlaceholderText(/Search by name.../i);
      const searchButton = screen.getByRole('button', { name: /Search/i });

      await user.type(searchInput, 'Sunder');
      await user.click(searchButton);

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('createdBy=Sunder')
        );
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_40:::When user types in search input and presses Enter key, an HTTP GET request should be made with createdBy query parameter:::5:::', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ 
            success: true, 
            count: 1, 
            data: [bidsListResponse[0]] 
          }),
        })
      );
      global.fetch = mockFetch;

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const searchInput = screen.getByPlaceholderText(/Search by name.../i);

      await user.type(searchInput, 'Sunder{Enter}');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('createdBy=Sunder')
        );
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_41:::When search is performed, only the matching bid(s) should be displayed:::5:::', async () => {
  const user = userEvent.setup();
  renderApp();

  // Wait for initial load
  await waitFor(() => {
    expect(screen.getByText('4000')).toBeInTheDocument();
  }, { timeout: 10000 });

  const searchInput = screen.getByPlaceholderText(/Search by name.../i);
  const searchButton = screen.getByRole('button', { name: /Search/i });

  // Perform search
  await user.clear(searchInput);
  await user.type(searchInput, 'Sunder');
  await user.click(searchButton);

  // Wait for search to complete
  await waitFor(() => {
    expect(screen.getByText('Sunder Yadav')).toBeInTheDocument();
  }, { timeout: 10000 });
  
  // After search, only Sunder should be visible
  expect(screen.getByText('Sunder Yadav')).toBeInTheDocument();
  expect(screen.getByText('4000')).toBeInTheDocument();
  
  // Other creators should NOT be visible
  expect(screen.queryByText('Rajesh Kumar')).not.toBeInTheDocument();
  expect(screen.queryByText('Priya Sharma')).not.toBeInTheDocument();
  expect(screen.queryByText('Amit Verma')).not.toBeInTheDocument();
}, 15000);


  });

  // ============================================
  // NEW TESTS - SORT FUNCTIONALITY
  // ============================================

  describe('Sort Functionality Tests', () => {
    it(':::RJSCED18BN_test_42:::Bid List Page should have a sort dropdown with options "Sort by Date", "Oldest First", and "Newest First":::5:::', async () => {
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sortSelect = screen.getByRole('combobox');
      expect(sortSelect).toBeInTheDocument();

      expect(screen.getByRole('option', { name: /Sort by Date/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Oldest First/i })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: /Newest First/i })).toBeInTheDocument();
    });

    it(':::RJSCED18BN_test_43:::When "Oldest First" is selected, an HTTP GET request should be made with sortBy=asc query parameter:::5:::', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ 
            success: true, 
            count: 4, 
            data: bidsListResponse 
          }),
        })
      );
      global.fetch = mockFetch;

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sortSelect = screen.getByRole('combobox');
      await user.selectOptions(sortSelect, 'asc');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=asc')
        );
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_44:::When "Newest First" is selected, an HTTP GET request should be made with sortBy=desc query parameter:::5:::', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ 
            success: true, 
            count: 4, 
            data: bidsListResponse 
          }),
        })
      );
      global.fetch = mockFetch;

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sortSelect = screen.getByRole('combobox');
      await user.selectOptions(sortSelect, 'desc');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=desc')
        );
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_45:::When "Sort by Date" is selected after sorting, an HTTP GET request should be made without sortBy query parameter:::5:::', async () => {
      const user = userEvent.setup();
      const mockFetch = vi.fn(() =>
        Promise.resolve({
          json: () => Promise.resolve({ 
            success: true, 
            count: 4, 
            data: bidsListResponse 
          }),
        })
      );
      global.fetch = mockFetch;

      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sortSelect = screen.getByRole('combobox');
      
      await user.selectOptions(sortSelect, 'asc');

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('sortBy=asc')
        );
      }, { timeout: 10000 });

      await user.selectOptions(sortSelect, '');

      await waitFor(() => {
        const lastCall = mockFetch.mock.calls[mockFetch.mock.calls.length - 1][0];
        expect(lastCall).not.toContain('sortBy');
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_46:::When sorted by "Oldest First", bids should be displayed in ascending order of startDate:::5:::', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sortSelect = screen.getByRole('combobox');
      await user.selectOptions(sortSelect, 'asc');

      await waitFor(() => {
        const bidRows = screen.getAllByText(/2024-02-1[34]/);
        expect(bidRows.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 10000 });
    });

    it(':::RJSCED18BN_test_47:::When sorted by "Newest First", bids should be displayed in descending order of startDate:::5:::', async () => {
      const user = userEvent.setup();
      renderApp();

      await waitFor(() => {
        expect(screen.getByText('4000')).toBeInTheDocument();
      }, { timeout: 10000 });

      const sortSelect = screen.getByRole('combobox');
      await user.selectOptions(sortSelect, 'desc');

      await waitFor(() => {
        const bidRows = screen.getAllByText(/2024-02-1[34]/);
        expect(bidRows.length).toBeGreaterThanOrEqual(2);
      }, { timeout: 10000 });
    });
  });

  // ============================================
  // NEW TESTS - LOGO IMAGE TEST
  // ============================================

  describe('Sidebar Logo Image Tests', () => {
    it(':::RJSCED18BN_test_48:::Sidebar should consist of an HTML img element with alt text as "logo-image":::5:::', () => {
      renderApp();
      const logoImage = screen.getByAltText('logo-image');
      expect(logoImage).toBeInTheDocument();
      expect(logoImage.tagName).toBe('IMG');
    });
  });
});